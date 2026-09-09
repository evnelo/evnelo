/** Browser-safe constants shared by the dashboard UI and the service layer. */

export const SOCIAL_PLATFORMS = ["website", "x", "linkedin", "instagram", "youtube", "discord", "bluesky", "threads", "tiktok", "mastodon", "other"] as const;

export const FIELD_TYPES = ["short_text", "long_text", "email", "phone", "number", "select", "multi_select", "checkbox", "date", "url", "file", "consent"] as const;
export const FIELD_TYPE_LABELS: Record<(typeof FIELD_TYPES)[number], string> = {
  short_text: "Short text", long_text: "Long text", email: "Email", phone: "Phone", number: "Number", select: "Single choice",
  multi_select: "Multiple choice", checkbox: "Checkbox", date: "Date", url: "Link", file: "File upload", consent: "Consent (must be ticked)",
};
