/** Minimal RFC 5545 VEVENT builder for "add to calendar" links. */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string) {
  const out: string[] = [];
  let buf = "";
  for (const ch of line) {
    if (Buffer.byteLength(buf + ch) > 75) { out.push(buf); buf = " " + ch; } else buf += ch;
  }
  out.push(buf);
  return out.join("\r\n");
}

export function buildIcs(e: {
  uid: string; start: Date; end: Date; summary: string; description?: string | null; location?: string | null; url: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Evnelo//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `URL:${e.url}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
