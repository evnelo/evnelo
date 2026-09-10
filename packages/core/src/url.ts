export function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isHttpUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
