import { z } from "zod";

/**
 * Props of the "Teaser" composition.
 * `photo`, `clip` and `audio` are either a path inside the public folder
 * (resolved with staticFile) or an absolute http(s) URL.
 */
export const teaserPropsSchema = z.object({
  restaurant: z.string().min(1).max(40),
  dish: z.string().min(1).max(60),
  price: z.string().max(12).nullable(),
  /** Big opening line. Keep it to 2-4 words so it can be read in two seconds. */
  hook: z.string().min(1).max(40),
  photo: z.string().min(1),
  /** Optional moving clip of the same dish for the middle scene. */
  clip: z.string().min(1).nullable(),
  audio: z.string().min(1).nullable(),
  /** Where the food sits in the photo, 0-1 from the left and from the top. */
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
});

export type TeaserProps = z.infer<typeof teaserPropsSchema>;

const unitInterval = z.coerce.number().min(0, "must be between 0 and 1").max(1, "must be between 0 and 1");
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

/** One teaser job as typed on the command line or in a CSV row. */
export const jobInputSchema = z.object({
  restaurant: z.string().trim().min(1, "restaurant is required").max(40, "restaurant must be 40 characters or fewer"),
  dish: z.string().trim().min(1, "dish is required").max(60, "dish must be 60 characters or fewer"),
  price: z.string().trim().max(12, "price must be 12 characters or fewer").optional(),
  hook: z.string().trim().max(40, "hook must be 40 characters or fewer").optional(),
  photo: z.string().trim().min(1, "photo is required"),
  clip: z.string().trim().optional(),
  audio: z.string().trim().optional(),
  focusX: z.preprocess(blankToUndefined, unitInterval.optional()),
  focusY: z.preprocess(blankToUndefined, unitInterval.optional()),
});

export type JobInput = z.infer<typeof jobInputSchema>;

export const DEFAULT_HOOK = "Hungry yet?";
