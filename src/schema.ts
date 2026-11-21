import { z } from "zod";

// Text rules shared by the composition props, the single CLI and CSV rows.
// An empty `price` means "no price"; an empty `audio` means "silent".
const text = {
  restaurant: z
    .string()
    .trim()
    .min(1, "Restaurant name is required.")
    .max(40, "Restaurant name must be at most 40 characters."),
  dish: z
    .string()
    .trim()
    .min(1, "Dish name is required.")
    .max(60, "Dish name must be at most 60 characters."),
  price: z.string().trim().max(12, "Price must be at most 12 characters."),
};

// Props of the "Teaser" composition. `photo` and `audio` are file names
// inside the bundle's public dir, loaded with staticFile().
export const teaserSchema = z.object({
  ...text,
  photo: z.string().min(1, "Photo is required."),
  audio: z.string(),
});

export type TeaserProps = z.infer<typeof teaserSchema>;

// One lead: a CSV row, or the single CLI's flags. `photo` and `audio`
// are paths on disk, relative to the current directory.
export const leadSchema = z.object({
  ...text,
  photo: z.string().trim().min(1, "Photo path is required."),
  audio: z.string().trim(),
});

export type Lead = z.infer<typeof leadSchema>;
