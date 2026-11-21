import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { TeaserError } from "./errors";

const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MIN_SHORT_SIDE = 720;

/**
 * Checks that the photo exists, is a supported still image and is big enough
 * to fill a 1080x1920 frame without being blown up.
 */
export const assertUsablePhoto = (photoPath: string, row: number | null = null): void => {
  if (!fs.existsSync(photoPath) || !fs.statSync(photoPath).isFile()) {
    throw new TeaserError("PHOTO_NOT_FOUND", `Photo not found: ${photoPath}`, row);
  }

  const ext = path.extname(photoPath).toLowerCase();
  if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
    throw new TeaserError(
      "PHOTO_UNSUPPORTED",
      `Photo must be one of ${ALLOWED_PHOTO_EXTENSIONS.join(", ")}, got "${ext || "no extension"}": ${photoPath}`,
      row,
    );
  }

  let width: number | undefined;
  let height: number | undefined;
  try {
    const size = imageSize(fs.readFileSync(photoPath));
    width = size.width;
    height = size.height;
  } catch (err) {
    throw new TeaserError(
      "PHOTO_UNSUPPORTED",
      `Could not read image dimensions from ${photoPath}: ${err instanceof Error ? err.message : String(err)}`,
      row,
    );
  }

  if (!width || !height) {
    throw new TeaserError("PHOTO_UNSUPPORTED", `Could not read image dimensions from ${photoPath}`, row);
  }

  const shortSide = Math.min(width, height);
  if (shortSide < MIN_SHORT_SIDE) {
    throw new TeaserError(
      "PHOTO_TOO_SMALL",
      `Photo's shortest side is ${shortSide}px, needs at least ${MIN_SHORT_SIDE}px: ${photoPath}`,
      row,
    );
  }
};

export const assertUsableAudio = (audioPath: string, row: number | null = null): void => {
  if (!fs.existsSync(audioPath) || !fs.statSync(audioPath).isFile()) {
    throw new TeaserError("AUDIO_NOT_FOUND", `Audio not found: ${audioPath}`, row);
  }
};
