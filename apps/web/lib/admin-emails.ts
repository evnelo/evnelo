/** `ADMIN_EMAILS` as a set: comma or whitespace separated, trimmed, lowercased (sign-in emails are stored lowercased). */
export function parseAdminEmails(raw: string | undefined | null): ReadonlySet<string> {
  return new Set((raw ?? "").split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")));
}

/** Whether this signed-in email may open the platform admin pages. An empty list admits nobody. */
export function isPlatformAdmin(email: string | null | undefined, admins: ReadonlySet<string>) {
  return Boolean(email) && admins.has(email!.trim().toLowerCase());
}
