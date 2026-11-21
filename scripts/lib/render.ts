import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { TeaserError, toTeaserError } from "./errors";
import { assertUsableAudio, assertUsablePhoto } from "./probe";
import { slug } from "./slug";
import { jobInputSchema, type JobInput } from "../../src/schema";

export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
export const ENTRY_POINT = path.join(PROJECT_ROOT, "src", "index.ts");
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
/**
 * Photos and music live outside public/ (in in/ and assets/audio/), but the
 * composition can only load files the bundle serves, and `bundle()` copies
 * public/ as it stands at that moment. So every input is copied in here BEFORE
 * bundling, and the whole folder is deleted afterwards. The alternative,
 * file:// URLs, is blocked by the render browser's page origin.
 */
const STAGING_DIR = path.join(PUBLIC_DIR, "_staged");
export const COMPOSITION_ID = "Teaser";

/**
 * By default Remotion downloads and manages its own browser, which is what the
 * Remotion docs recommend. On a machine that cannot reach remotion.media (a
 * locked-down CI box or sandbox), set TEASER_CHROME_PATH to a local Chrome
 * binary instead, e.g. TEASER_CHROME_PATH=/usr/bin/google-chrome.
 */
const chromeOverride = (): { browserExecutable?: string } => {
  const executable = process.env.TEASER_CHROME_PATH;
  if (!executable) {
    return {};
  }
  if (!fs.existsSync(executable)) {
    throw new TeaserError("RENDER_FAILED", `TEASER_CHROME_PATH is set but no file exists there: ${executable}`);
  }
  return { browserExecutable: executable };
};

export type Job = {
  restaurant: string;
  dish: string;
  price: string | null;
  photoPath: string;
  audioPath: string | null;
  outputPath: string;
};

/** A job whose input files have been copied into public/_staged. */
export type StagedJob = Job & { stagedPhoto: string; stagedAudio: string | null };

export const defaultOutputPath = (restaurant: string, dish: string): string =>
  path.join(PROJECT_ROOT, "out", slug(restaurant), `${slug(dish)}.mp4`);

/** Validates one job's fields and files. Throws a TeaserError if anything is wrong. */
export const buildJob = (input: unknown, row: number | null, explicitOut?: string): Job => {
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new TeaserError(row === null ? "INVALID_ARGS" : "INVALID_ROW", message, row);
  }

  const value: JobInput = parsed.data;
  const photoPath = path.resolve(PROJECT_ROOT, value.photo);
  assertUsablePhoto(photoPath, row);

  let audioPath: string | null = null;
  if (value.audio && value.audio.length > 0) {
    audioPath = path.resolve(PROJECT_ROOT, value.audio);
    assertUsableAudio(audioPath, row);
  }

  return {
    restaurant: value.restaurant,
    dish: value.dish,
    price: value.price && value.price.length > 0 ? value.price : null,
    photoPath,
    audioPath,
    outputPath: explicitOut
      ? path.resolve(PROJECT_ROOT, explicitOut)
      : defaultOutputPath(value.restaurant, value.dish),
  };
};

const stageFile = (filePath: string): string => {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const name = `${crypto.randomBytes(8).toString("hex")}${path.extname(filePath).toLowerCase()}`;
  fs.copyFileSync(filePath, path.join(STAGING_DIR, name));
  return `_staged/${name}`;
};

/** Copies every job's photo and audio into public/_staged. Call BEFORE bundleOnce(). */
export const stageJobs = (jobs: Job[]): StagedJob[] =>
  jobs.map((job) => ({
    ...job,
    stagedPhoto: stageFile(job.photoPath),
    stagedAudio: job.audioPath ? stageFile(job.audioPath) : null,
  }));

/** Removes public/_staged. Always call this, even when a render fails. */
export const clearStaging = (): void => {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
};

/** Bundles the project once. Reuse the result for every render in a run. */
export const bundleOnce = async (): Promise<string> => {
  try {
    return await bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR });
  } catch (err) {
    throw toTeaserError(err, "RENDER_FAILED");
  }
};

export type RenderOptions = {
  serveUrl: string;
  job: StagedJob;
  /** Also write frames 0, 100 and 200 as PNGs into out/_check/. */
  stills?: boolean;
  /** CSV row number, for the error line. */
  row?: number | null;
};

export const renderJob = async ({ serveUrl, job, stills = false, row = null }: RenderOptions): Promise<void> => {
  try {
    const chrome = chromeOverride();
    const inputProps = {
      restaurant: job.restaurant,
      dish: job.dish,
      price: job.price,
      photo: job.stagedPhoto,
      audio: job.stagedAudio,
    };

    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, ...chrome });
    fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      pixelFormat: "yuv420p",
      outputLocation: job.outputPath,
      inputProps,
      overwrite: true,
      licenseKey: "free-license",
      isProduction: false,
      ...chrome,
    });

    if (stills) {
      const checkDir = path.join(PROJECT_ROOT, "out", "_check");
      fs.mkdirSync(checkDir, { recursive: true });
      for (const frame of [0, 100, 200]) {
        await renderStill({
          composition,
          serveUrl,
          frame,
          imageFormat: "png",
          output: path.join(checkDir, `frame-${String(frame).padStart(3, "0")}.png`),
          inputProps,
          overwrite: true,
          licenseKey: "free-license",
          isProduction: false,
          ...chrome,
        });
      }
    }
  } catch (err) {
    throw toTeaserError(err, "RENDER_FAILED", row);
  }
};
