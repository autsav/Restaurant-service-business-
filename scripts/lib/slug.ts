// "Fatt Pundit" -> "fatt-pundit", "Café Déjà Vu!" -> "cafe-deja-vu".
// Lowercase, strip accents, non-alphanumerics -> "-", collapse repeats, trim "-".
export const slugify = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
