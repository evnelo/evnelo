import { PKPass } from "passkit-generator";
import { PNG } from "pngjs";
import { env } from "@/lib/env";
import { secretFromEnv, whereLabel, type TicketPassData } from "./index";

// The ticket's paper palette, so the pass matches /t/{token}
const PAPER = "rgb(241, 230, 178)";
const INK = "rgb(43, 36, 7)";

/** Apple requires icon.png; until per-org artwork upload exists we ship a flat ink square. */
function solidPng(size: number, rgb: [number, number, number]) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = rgb[0]; png.data[i * 4 + 1] = rgb[1]; png.data[i * 4 + 2] = rgb[2]; png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}
const icons = { "icon.png": solidPng(29, [43, 36, 7]), "icon@2x.png": solidPng(58, [43, 36, 7]), "icon@3x.png": solidPng(87, [43, 36, 7]) };

/** Builds a signed .pkpass (Apple Wallet event ticket). Requires the APPLE_* env vars. */
export async function buildApplePass(t: TicketPassData): Promise<Buffer> {
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_TEAM_ID,
    serialNumber: t.ticketId,
    organizationName: t.orgName,
    description: `${t.eventName} ticket`,
    logoText: t.orgName,
    backgroundColor: PAPER,
    foregroundColor: INK,
    labelColor: INK,
    relevantDate: t.startsAt.toISOString(),
    expirationDate: new Date(t.endsAt.getTime() + 24 * 3600_000).toISOString(),
    ...(t.lat != null && t.lng != null ? { locations: [{ latitude: t.lat, longitude: t.lng, relevantText: t.eventName }] } : {}),
    barcodes: [{ message: t.ticketUrl, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: t.attendeeName }],
    eventTicket: {
      headerFields: [{ key: "date", label: "DATE", value: t.startsAt.toISOString(), dateStyle: "PKDateStyleMedium", timeStyle: "PKDateStyleShort" }],
      primaryFields: [{ key: "event", label: "EVENT", value: t.eventName }],
      secondaryFields: [
        { key: "name", label: "ADMIT", value: t.attendeeName },
        { key: "where", label: "WHERE", value: whereLabel(t), textAlignment: "PKTextAlignmentRight" },
      ],
      auxiliaryFields: [{ key: "type", label: "TICKET", value: t.ticketTypeName }],
      backFields: [
        { key: "url", label: "Ticket page", value: t.ticketUrl },
        ...(t.address ? [{ key: "address", label: "Address", value: [t.venueName, t.address, t.city].filter(Boolean).join("\n") }] : []),
      ],
    },
  };

  const pass = new PKPass(
    { ...icons, "pass.json": Buffer.from(JSON.stringify(passJson)) },
    {
      wwdr: secretFromEnv(env.APPLE_WWDR_CERT!, "-----BEGIN"),
      signerCert: secretFromEnv(env.APPLE_PASS_CERT!, "-----BEGIN"),
      signerKey: secretFromEnv(env.APPLE_PASS_KEY!, "-----BEGIN"),
      signerKeyPassphrase: env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    },
  );
  return pass.getAsBuffer();
}
