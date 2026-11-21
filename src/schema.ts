import { z } from "zod";

/**
 * Props of the "Teaser" composition.
 * `photo` and `audio` are either a path inside the public folder
 * (resolved with staticFile) or an absolute http(s) URL.
 */
export const teaserPropsSchema = z.object({
  restaurant: z.string().min(1).max(40),
  dish: z.string().min(1).max(60),
  price: z.string().max(12).nullable(),
  photo: z.string().min(1),
  audio: z.string().min(1).nullable(),
});

export type TeaserProps = z.infer<typeof teaserPropsSchema>;

/** One teaser job as typed on the command line or in a CSV row. */
export const jobInputSchema = z.object({
  restaurant: z.string().trim().min(1, "restaurant is required").max(40, "restaurant must be 40 characters or fewer"),
  dish: z.string().trim().min(1, "dish is required").max(60, "dish must be 60 characters or fewer"),
  price: z.string().trim().max(12, "price must be 12 characters or fewer").optional(),
  photo: z.string().trim().min(1, "photo is required"),
  audio: z.string().trim().optional(),
});

export type JobInput = z.infer<typeof jobInputSchema>;
