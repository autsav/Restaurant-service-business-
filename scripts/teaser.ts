// Single teaser:
//   npm run teaser -- --photo in/dish.jpg --restaurant "Fatt Pundit" \
//     --dish "Crackling Spinach" [--price "£9.50"] [--audio assets/audio/bed.mp3] [--out out/custom.mp4]
import { parseArgs } from "node:util";
import { printError, printOk, toTeaserError } from "./lib/errors";
import {
  checkLeadFiles,
  defaultOutput,
  parseLead,
  renderTeasers,
} from "./lib/render";

const main = async (): Promise<number> => {
  const started = Date.now();

  let flags;
  try {
    flags = parseArgs({
      options: {
        photo: { type: "string" },
        restaurant: { type: "string" },
        dish: { type: "string" },
        price: { type: "string" },
        audio: { type: "string" },
        out: { type: "string" },
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

  let lead;
  try {
    lead = parseLead(
      {
        restaurant: flags.restaurant ?? "",
        dish: flags.dish ?? "",
        price: flags.price ?? "",
        photo: flags.photo ?? "",
        audio: flags.audio ?? "",
      },
      "INVALID_ARGS",
    );
    if (flags.out !== undefined && !/\.mp4$/i.test(flags.out)) {
      printError("INVALID_ARGS", "--out must end in .mp4.", null);
      return 2;
    }
  } catch (err) {
    printError(
      "INVALID_ARGS",
      toTeaserError(err, "INVALID_ARGS").message,
      null,
    );
    return 2;
  }

  try {
    checkLeadFiles(lead);
  } catch (err) {
    const e = toTeaserError(err, "INVALID_ARGS");
    printError(e.code, e.message, null);
    return 1;
  }

  const output = flags.out ?? defaultOutput(lead);
  let ok = false;
  await renderTeasers([{ lead, output, row: null }], (_job, result) => {
    if (result.ok) {
      ok = true;
      printOk({ output: result.output, durationMs: Date.now() - started });
    } else {
      printError(result.error.code, result.error.message, null);
    }
  });
  return ok ? 0 : 1;
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
