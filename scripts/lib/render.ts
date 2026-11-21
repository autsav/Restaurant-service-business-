import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { leadSchema, type Lead, type TeaserProps } from "../../src/schema";
import { type ErrorCode, TeaserError, toTeaserError } from "./errors";
import { probeImageSize } from "./probe";
import { slugify } from "./slug";

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MIN_PHOTO_SIDE = 720;

// Checks text fields with the zod schema. `code` is INVALID_ARGS for the
// single CLI and INVALID_ROW for a CSV row.
export const parseLead = (raw: unknown, code: ErrorCode): Lead => {
  const result = leadSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new TeaserError(code, issue.message);
  }
  const lead = result.data;
  if (slugify(lead.restaurant) === "" || slugify(lead.dish) === "") {
    throw new TeaserError(
      code,
      "Restaurant and dish names must contain at least one letter or digit.",
    );
  }
  return lead;
};

// Checks the files a lead points to: the photo exists, is jpg/jpeg/png/webp
// and its shortest side is at least 720px; the audio, if given, exists.
export const checkLeadFiles = (lead: Lead): void => {
  if (!isFile(lead.photo)) {
    throw new TeaserError("PHOTO_NOT_FOUND", `Photo not found: ${lead.photo}`);
  }
  const ext = path.extname(lead.photo).toLowerCase();
  if (PHOTO_EXTENSIONS.indexOf(ext) === -1) {
    throw new TeaserError(
      "PHOTO_UNSUPPORTED",
      `Photo must be a .jpg, .jpeg, .png or .webp file: ${lead.photo}`,
    );
  }
  const size = probeImageSize(lead.photo);
  if (size === null) {
    throw new TeaserError(
      "PHOTO_UNSUPPORTED",
      `Photo is not a readable JPEG, PNG or WebP image: ${lead.photo}`,
    );
  }
  const shortest = Math.min(size.width, size.height);
  if (shortest < MIN_PHOTO_SIDE) {
    throw new TeaserError(
      "PHOTO_TOO_SMALL",
      `Photo is ${size.width}x${size.height}; its shortest side must be at least ${MIN_PHOTO_SIDE}px: ${lead.photo}`,
    );
  }
  if (lead.audio !== "" && !isFile(lead.audio)) {
    throw new TeaserError("AUDIO_NOT_FOUND", `Audio not found: ${lead.audio}`);
  }
};

// out/{restaurant-slug}/{dish-slug}.mp4
export const defaultOutput = (lead: Lead): string =>
  path.posix.join("out", slugify(lead.restaurant), `${slugify(lead.dish)}.mp4`);

// `row` is the CSV row number, or null for the single CLI.
export type RenderJob = { lead: Lead; output: string; row: number | null };

export type RenderResult =
  | { ok: true; output: string; durationMs: number }
  | { ok: false; error: TeaserError; durationMs: number };

// The dataset-render pattern: bundle once, then selectComposition() +
// renderMedia() per job, one at a time. Calls `onResult` after each job.
//
// Photos and audio live outside public/, so they are copied into a temporary
// staging dir that becomes the bundle's publicDir. The composition loads them
// with staticFile(). The originals are never touched.
export const renderTeasers = async (
  jobs: RenderJob[],
  onResult: (job: RenderJob, result: RenderResult) => void,
): Promise<void> => {
  if (jobs.length === 0) {
    return;
  }
  const stagingDir = mkdtempSync(path.join(tmpdir(), "teaser-assets-"));
  let serveUrl: string | null = null;
  try {
    const props = jobs.map((job) => stageAssets(job.lead, stagingDir));

    let bundleError: TeaserError | null = null;
    try {
      serveUrl = await bundle({
        entryPoint: path.resolve("src/index.ts"),
        publicDir: stagingDir,
        rspack: true, // Matches Config.setRspack(true) in remotion.config.ts.
      });
    } catch (err) {
      bundleError = toTeaserError(err, "RENDER_FAILED");
    }

    for (let i = 0; i < jobs.length; i++) {
      const started = Date.now();
      if (serveUrl === null) {
        onResult(jobs[i], {
          ok: false,
          error: bundleError as TeaserError,
          durationMs: 0,
        });
        continue;
      }
      try {
        await renderOne(serveUrl, props[i], jobs[i].output);
        onResult(jobs[i], {
          ok: true,
          output: jobs[i].output,
          durationMs: Date.now() - started,
        });
      } catch (err) {
        onResult(jobs[i], {
          ok: false,
          error: toTeaserError(err, "RENDER_FAILED"),
          durationMs: Date.now() - started,
        });
      }
    }
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
    if (serveUrl !== null) {
      rmSync(serveUrl, { recursive: true, force: true });
    }
  }
};

const renderOne = async (
  serveUrl: string,
  inputProps: TeaserProps,
  output: string,
): Promise<void> => {
  // Only set where Remotion can't download its own browser (see README).
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

  const composition = await selectComposition({
    serveUrl,
    id: "Teaser",
    inputProps,
    browserExecutable,
    logLevel: "error",
  });

  // Render to a temp name and rename at the end, so a failed render never
  // leaves a file that a later batch run would mistake for a finished one.
  mkdirSync(path.dirname(output), { recursive: true });
  const partial = output.replace(/\.mp4$/i, "") + ".partial.mp4";
  try {
    await renderMedia({
      composition,
      serveUrl,
      inputProps,
      codec: "h264",
      pixelFormat: "yuv420p",
      // Standard limited-range BT.709. Without it the JPEG frames give a
      // full-range "yuvj420p" stream. Encoding metadata only, not a grade.
      colorSpace: "bt709",
      imageFormat: "jpeg",
      outputLocation: partial,
      overwrite: true,
      browserExecutable,
      // No key: a key would send a usage event over the network at render time.
      licenseKey: null,
      logLevel: "error",
    });
    renameSync(partial, output);
  } finally {
    rmSync(partial, { force: true });
  }
};

// Copies the lead's photo/audio into the staging dir and returns the
// composition props that point at them. Names are derived from the absolute
// path, so a file shared by several rows is copied once.
const stageAssets = (lead: Lead, stagingDir: string): TeaserProps => ({
  restaurant: lead.restaurant,
  dish: lead.dish,
  price: lead.price,
  photo: stageFile(lead.photo, stagingDir),
  audio: lead.audio === "" ? "" : stageFile(lead.audio, stagingDir),
});

const stageFile = (file: string, stagingDir: string): string => {
  const abs = path.resolve(file);
  const name =
    createHash("sha1").update(abs).digest("hex").slice(0, 12) +
    path.extname(abs).toLowerCase();
  const target = path.join(stagingDir, name);
  if (!existsSync(target)) {
    copyFileSync(abs, target);
  }
  return name;
};

const isFile = (file: string): boolean => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};
