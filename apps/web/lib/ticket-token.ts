/** Same rule as parseTicketToken in @evnelo/core/services, duplicated here because that subpath is server-only. */
export function parseTicketToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const match = /\/t\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/.exec(text);
  if (match) return match[1]!;
  return /^[A-Za-z0-9_-]{16,64}$/.test(text) ? text : null;
}
