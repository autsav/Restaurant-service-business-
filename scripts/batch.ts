// CSV batch (columns: restaurant,dish,price,photo,audio):
//   npm run batch -- --csv leads.csv [--dry-run] [--force]
import { parse } from "csv-parse/sync";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Lead } from "../src/schema";
import {
  type ErrorCode,
  printError,
  printOk,
  toTeaserError,
} from "./lib/errors";
import {
  checkLeadFiles,
  defaultOutput,
  parseLead,
  type RenderJob,
  renderTeasers,
} from "./lib/render";

const MANIFEST = "out/manifest.json";

type ManifestEntry = {
  row: number;
  restaurant: string;
  dish: string;
  output: string | null;
  status: "rendered" | "skipped" | "failed";
  code?: ErrorCode;
  durationMs: number;
};

const main = async (): Promise<number> => {
  let flags;
  try {
    flags = parseArgs({
      options: {
        csv: { type: "string" },
        "dry-run": { type: "boolean", default: false },
        force: { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (err) {
    printError(
      "INVALID_ARGS",
      toTeaserError(err, "INVALID_ARGS").message,
      null,
    );
    return 2;
  }
  if (flags.csv === undefined) {
    printError("INVALID_ARGS", "--csv <file> is required.", null);
    return 2;
  }

  let records: Record<string, string>[];
  try {
    records = parse(readFileSync(flags.csv), {
      columns: true,
      bom: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    const message = toTeaserError(err, "INVALID_ARGS").message;
    printError(
      "INVALID_ARGS",
      `Could not read CSV ${flags.csv}: ${message}`,
      null,
    );
    return 2;
  }

  const dryRun = flags["dry-run"] === true;
  const force = flags.force === true;
  const entries: ManifestEntry[] = [];
  const jobs: RenderJob[] = [];

  // Validate every row first. Rows are numbered from 1, header excluded.
  records.forEach((record, index) => {
    const row = index + 1;
    const started = Date.now();
    const raw = {
      restaurant: record.restaurant ?? "",
      dish: record.dish ?? "",
      price: record.price ?? "",
      photo: record.photo ?? "",
      audio: record.audio ?? "",
    };
    const entry: ManifestEntry = {
      row,
      restaurant: raw.restaurant,
      dish: raw.dish,
      output: null,
      status: "failed",
      durationMs: 0,
    };
    entries.push(entry);

    let lead: Lead;
    try {
      lead = parseLead(raw, "INVALID_ROW");
      entry.output = defaultOutput(lead);
      checkLeadFiles(lead);
    } catch (err) {
      const e = toTeaserError(err, "INVALID_ROW");
      entry.code = e.code;
      entry.durationMs = Date.now() - started;
      printError(e.code, e.message, row);
      return;
    }

    const output = entry.output as string;
    const skip = !force && existsSync(output);
    if (dryRun) {
      printOk({ row, output, action: skip ? "skip" : "render" });
      return;
    }
    if (skip) {
      entry.status = "skipped";
      entry.durationMs = Date.now() - started;
      printOk({ row, output, status: "skipped", durationMs: entry.durationMs });
      return;
    }
    jobs.push({ lead, output, row });
  });

  if (dryRun) {
    // Dry run: no bundle, no render, no files written.
    return entries.some((e) => e.code !== undefined) ? 1 : 0;
  }

  // Renders run one at a time; a failed row does not stop the batch.
  await renderTeasers(jobs, (job, result) => {
    const row = job.row as number;
    const entry = entries[row - 1];
    entry.durationMs = result.durationMs;
    if (result.ok) {
      entry.status = "rendered";
      printOk({
        row,
        output: result.output,
        status: "rendered",
        durationMs: result.durationMs,
      });
    } else {
      entry.code = result.error.code;
      printError(result.error.code, result.error.message, row);
    }
  });

  mkdirSync("out", { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + "\n");
  return entries.some((e) => e.status === "failed") ? 1 : 0;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    printError(
      "RENDER_FAILED",
      toTeaserError(err, "RENDER_FAILED").message,
      null,
    );
    process.exit(1);
  },
);
