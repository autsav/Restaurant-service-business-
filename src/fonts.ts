import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const FONT_FAMILY = "Inter";

let pending: Promise<void> | null = null;

/**
 * Loads Inter (600 + 800) from public/fonts. Local files, so a render
 * needs no network access. Safe to call many times.
 */
export const loadTeaserFonts = (): Promise<void> => {
  if (!pending) {
    pending = Promise.all([
      loadFont({ family: FONT_FAMILY, url: staticFile("fonts/Inter-600.woff2"), weight: "600" }),
      loadFont({ family: FONT_FAMILY, url: staticFile("fonts/Inter-800.woff2"), weight: "800" }),
    ]).then(() => undefined);
  }
  return pending;
};
