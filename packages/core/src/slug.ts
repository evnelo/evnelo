/** URL slug from free text: lowercase ASCII, hyphen-separated, max 80 chars. Accents are folded. */
export function slugify(input: string, max = 80): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "event";
}

/** Short random suffix for slug collisions, e.g. "meetup-k3x9". */
export function slugSuffix(length = 4): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
