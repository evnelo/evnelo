import { SignJWT, importPKCS8 } from "jose";
import { env } from "@/lib/env";
import { secretFromEnv, whereLabel, type TicketPassData } from "./index";

const text = (value: string) => ({ defaultValue: { language: "en", value } });

/**
 * "Save to Google Wallet" URL. The class and object ride inside the signed JWT, so no
 * Wallet API round-trip is needed; Google creates them on first save. Requires
 * GOOGLE_WALLET_ISSUER_ID and a service account JSON.
 */
export async function googleWalletSaveUrl(t: TicketPassData): Promise<string> {
  const sa = JSON.parse(secretFromEnv(env.GOOGLE_WALLET_SERVICE_ACCOUNT!, "{")) as { client_email: string; private_key: string };
  const key = await importPKCS8(sa.private_key, "RS256");
  const issuer = env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = `${issuer}.event_${t.eventId}`;
  const objectId = `${issuer}.ticket_${t.ticketId}`;

  const eventTicketClass = {
    id: classId,
    issuerName: t.orgName,
    reviewStatus: "UNDER_REVIEW",
    eventName: text(t.eventName),
    dateTime: { start: t.startsAt.toISOString(), end: t.endsAt.toISOString() },
    ...(t.locationType !== "online" && t.venueName
      ? { venue: { name: text(t.venueName), address: text([t.address, t.city].filter(Boolean).join(", ") || t.venueName) } }
      : {}),
    hexBackgroundColor: "#f1e6b2",
    ...(t.logoUrl ? { logo: { sourceUri: { uri: t.logoUrl } } } : {}),
    ...(t.coverImageUrl ? { heroImage: { sourceUri: { uri: t.coverImageUrl } } } : {}),
  };
  const eventTicketObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    ticketHolderName: t.attendeeName,
    ticketType: text(t.ticketTypeName),
    barcode: { type: "QR_CODE", value: t.ticketUrl, alternateText: t.attendeeName },
    hexBackgroundColor: "#f1e6b2",
    textModulesData: [{ id: "where", header: "Where", body: whereLabel(t) }],
    linksModuleData: { uris: [{ id: "ticket", uri: t.ticketUrl, description: "Ticket page" }] },
  };

  const jwt = await new SignJWT({
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [env.APP_URL],
    payload: { eventTicketClasses: [eventTicketClass], eventTicketObjects: [eventTicketObject] },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
