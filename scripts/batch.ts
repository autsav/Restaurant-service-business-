/**
 * Renders a teaser per CSV row.
 *
 *   npm run batch -- --csv tests/fixtures/leads.csv [--dry-run] [--force]
 *
 * CSV columns: restaurant,dish,price,photo,audio
 * One bad row never stops the batch. Results land in out/manifest.json.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { TeaserError, printError, toTeaserError, type ErrorCode } from "./lib/errors";
import {
  PROJECT_ROOT,
  bundleOnce,
  buildJob,
  clearStaging,
  renderJob,
  stageJobs,
  type Job,
  type StagedJob,
} from "./lib/render";

const REQUIRED_COLUMNS = ["restaurant", "dish", "price", "photo", "audio"] as const;

type ManifestEntry = {
  row: number;
  restaurant: string;
  dish: string;
  output: string | null;
  status: "rendered" | "skipped" | "failed";
  code?: ErrorCode;
  durationMs: number;
};

const parseArgs = (argv: string[]): { csv: string; dryRun: boolean; force: boolean } => {
  let csv: string | null = null;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--csv") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new TeaserError("INVALID_ARGS", 'Flag "--csv" needs a value');
      }
      csv = value;
      i += 1;
    } else {
      throw new TeaserError("INVALID_ARGS", `Unexpected argument "${arg}". Usage: --csv <file> [--dry-run] [--force]`);
    }
  }

  if (!csv) {
    throw new TeaserError("INVALID_ARGS", 'Missing required flag "--csv"');
  }
  return { csv, dryRun, force };
};

const readRows = (csvPath: string): Record<string, string>[] => {
  if (!fs.existsSync(csvPath)) {
    throw new TeaserError("INVALID_ARGS", `CSV not found: ${csvPath}`);
  }
  let rows: Record<string, string>[];
  try {
    rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    throw new TeaserError("INVALID_ARGS", `Could not parse CSV: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (rows.length === 0) {
    throw new TeaserError("INVALID_ARGS", `CSV has no data rows: ${csvPath}`);
  }
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missing.length > 0) {
    throw new TeaserError("INVALID_ARGS", `CSV is missing column(s): ${missing.join(", ")}`);
  }
  return rows;
};

type Planned = { row: number; job: Job } | { row: number; error: TeaserError };

const main = async (): Promise<void> => {
  const { csv, dryRun, force } = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(PROJECT_ROOT, csv);
  const rows = readRows(csvPath);

  // 1. Validate every row first, so a dry run writes nothing and renders nothing.
  const planned: Planned[] = rows.map((raw, index) => {
    const row = index + 1;
    try {
      return { row, job: buildJob(raw, row) };
    } catch (err) {
      return { row, error: toTeaserError(err, "INVALID_ROW", row) };
    }
  });

  if (dryRun) {
    for (const item of planned) {
      if ("error" in item) {
        process.stdout.write(`row ${item.row}: ERROR ${item.error.code} — ${item.error.message}\n`);
      } else {
        const exists = fs.existsSync(item.job.outputPath);
        const note = exists && !force ? " (exists, would skip)" : "";
        process.stdout.write(
          `row ${item.row}: ok — ${path.relative(PROJECT_ROOT, item.job.outputPath)}${note}\n`,
        );
      }
    }
    const failed = planned.filter((item) => "error" in item).length;
    process.stdout.write(`\n${planned.length - failed} ok, ${failed} error(s). Dry run: nothing rendered.\n`);
    process.exit(failed > 0 ? 1 : 0);
  }

  // 2. Stage the inputs of every row we will actually render, bundle ONCE,
  //    then render row by row (never in parallel).
  const toRender = planned.filter(
    (item): item is { row: number; job: Job } =>
      "job" in item && (force || !fs.existsSync(item.job.outputPath)),
  );

  const stagedByRow = new Map<number, StagedJob>();
  let serveUrl: string | null = null;
  if (toRender.length > 0) {
    const staged = stageJobs(toRender.map((item) => item.job));
    toRender.forEach((item, index) => stagedByRow.set(item.row, staged[index]));
    serveUrl = await bundleOnce();
  }

  const manifest: ManifestEntry[] = [];

  for (const item of planned) {
    const startedAt = Date.now();

    if ("error" in item) {
      printError(item.error);
      manifest.push({
        row: item.row,
        restaurant: rows[item.row - 1].restaurant ?? "",
        dish: rows[item.row - 1].dish ?? "",
        output: null,
        status: "failed",
        code: item.error.code,
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    const { job, row } = item;
    const relativeOutput = path.relative(PROJECT_ROOT, job.outputPath);

    if (!force && fs.existsSync(job.outputPath)) {
      process.stdout.write(`row ${row}: skipped (exists) — ${relativeOutput}\n`);
      manifest.push({
        row,
        restaurant: job.restaurant,
        dish: job.dish,
        output: relativeOutput,
        status: "skipped",
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    try {
      await renderJob({ serveUrl: serveUrl as string, job: stagedByRow.get(row) as StagedJob, row });
      process.stdout.write(`row ${row}: rendered — ${relativeOutput}\n`);
      manifest.push({
        row,
        restaurant: job.restaurant,
        dish: job.dish,
        output: relativeOutput,
        status: "rendered",
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const teaserError = toTeaserError(err, "RENDER_FAILED", row);
      printError(teaserError);
      manifest.push({
        row,
        restaurant: job.restaurant,
        dish: job.dish,
        output: null,
        status: "failed",
        code: teaserError.code,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  clearStaging();

  const manifestPath = path.join(PROJECT_ROOT, "out", "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const counts = {
    rendered: manifest.filter((entry) => entry.status === "rendered").length,
    skipped: manifest.filter((entry) => entry.status === "skipped").length,
    failed: manifest.filter((entry) => entry.status === "failed").length,
  };
  process.stdout.write(
    `\n${counts.rendered} rendered, ${counts.skipped} skipped, ${counts.failed} failed. Manifest: out/manifest.json\n`,
  );
  process.exit(counts.failed > 0 ? 1 : 0);
};

main().catch((err) => {
  clearStaging();
  const teaserError = toTeaserError(err, "RENDER_FAILED");
  printError(teaserError);
  process.exit(teaserError.code === "INVALID_ARGS" ? 2 : 1);
});
