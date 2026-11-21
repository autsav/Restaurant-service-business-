/**
 * Renders ONE teaser.
 *
 *   npm run teaser -- --photo in/dish.jpg --restaurant "Fatt Pundit" --dish "Crackling Spinach" \
 *     [--price "£9.50"] [--audio assets/audio/bed.mp3] [--out out/custom.mp4] [--stills]
 */
import path from "node:path";
import { TeaserError, printError, printSuccess, toTeaserError } from "./lib/errors";
import { PROJECT_ROOT, bundleOnce, buildJob, clearStaging, renderJob, stageJobs } from "./lib/render";

const FLAGS = ["photo", "restaurant", "dish", "price", "audio", "out"] as const;
type Flag = (typeof FLAGS)[number];

const parseArgs = (argv: string[]): { values: Partial<Record<Flag, string>>; stills: boolean } => {
  const values: Partial<Record<Flag, string>> = {};
  let stills = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stills") {
      stills = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new TeaserError("INVALID_ARGS", `Unexpected argument "${arg}"`);
    }
    const name = arg.slice(2);
    if (!FLAGS.includes(name as Flag)) {
      throw new TeaserError("INVALID_ARGS", `Unknown flag "--${name}". Known flags: ${FLAGS.map((f) => `--${f}`).join(", ")}, --stills`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new TeaserError("INVALID_ARGS", `Flag "--${name}" needs a value`);
    }
    values[name as Flag] = value;
    i += 1;
  }

  return { values, stills };
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const { values, stills } = parseArgs(process.argv.slice(2));

  const job = buildJob(
    {
      restaurant: values.restaurant ?? "",
      dish: values.dish ?? "",
      price: values.price,
      photo: values.photo ?? "",
      audio: values.audio,
    },
    null,
    values.out,
  );

  // Inputs must be staged into public/ before bundling; see lib/render.ts.
  try {
    const [stagedJob] = stageJobs([job]);
    const serveUrl = await bundleOnce();
    await renderJob({ serveUrl, job: stagedJob, stills });
  } finally {
    clearStaging();
  }

  printSuccess(path.relative(PROJECT_ROOT, job.outputPath), Date.now() - startedAt);
};

main().catch((err) => {
  const teaserError = toTeaserError(err, "RENDER_FAILED");
  printError(teaserError);
  process.exit(teaserError.code === "INVALID_ARGS" ? 2 : 1);
});
