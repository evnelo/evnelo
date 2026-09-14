import { describe, expect, it, vi } from "vitest";
import { importSPKI, jwtVerify } from "jose";

// Throwaway signing material, so the builders run end to end without Apple or Google credentials.
// The Apple signature comes from openssl-generated self-signed certs: Wallet would reject it, but
// the bundle (pass.json, manifest, signature, icons) is produced by the same code path.
const fx = vi.hoisted(() => {
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  const { generateKeyPairSync } = require("node:crypto") as typeof import("node:crypto");
  const { mkdtempSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const { join } = require("node:path") as typeof import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "evnelo-wallet-"));
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const googleSa = JSON.stringify({ client_email: "wallet@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  let openssl = true;
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "2", "-subj", "/CN=Pass Type ID: pass.test/O=Evnelo/OU=TEAMID"], { stdio: "ignore" });
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "wwdr-key.pem"), "-out", join(dir, "wwdr.pem"), "-days", "2", "-subj", "/CN=Test WWDR"], { stdio: "ignore" });
  } catch {
    openssl = false;
  }
  const pem = (name: string) => (openssl ? readFileSync(join(dir, name), "utf8") : "");
  return { dir, openssl, googleSa, googlePublicPem: publicKey.export({ type: "spki", format: "pem" }) as string, certPath: join(dir, "cert.pem"), keyB64: Buffer.from(pem("key.pem")).toString("base64"), wwdrInline: pem("wwdr.pem").replace(/\n/g, "\\n") };
});

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://evnelo.test",
    APPLE_PASS_TYPE_ID: "pass.com.evnelo.ticket",
    APPLE_TEAM_ID: "TEAMID1234",
    APPLE_PASS_CERT: fx.certPath, // file path form
    APPLE_PASS_KEY: fx.keyB64, // base64 form
    APPLE_WWDR_CERT: fx.wwdrInline, // one-line inline form
    GOOGLE_WALLET_ISSUER_ID: "3388000000012345678",
    GOOGLE_WALLET_SERVICE_ACCOUNT: Buffer.from(fx.googleSa).toString("base64"),
  },
}));

import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { secretFromEnv, whereLabel, type TicketPassData } from "./index";
import { buildApplePass } from "./apple";
import { googleWalletSaveUrl } from "./google";

const ticket: TicketPassData = {
  ticketId: "tk_1", ticketUrl: "https://evnelo.test/t/tok", eventId: "ev_1", eventName: "Launch night", eventSlug: "launch-night",
  startsAt: new Date("2026-10-01T18:00:00Z"), endsAt: new Date("2026-10-01T21:00:00Z"), timezone: "America/Sao_Paulo",
  locationType: "in_person", venueName: "The Hall", address: "1 Main St", city: "Lisbon", lat: 38.7, lng: -9.1,
  attendeeName: "Ada Lovelace", ticketTypeName: "General", orgName: "InEvent", logoUrl: "https://cdn.test/logo.png", coverImageUrl: null,
};

describe("secretFromEnv", () => {
  const cert = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n";
  it("accepts inline PEM with escaped newlines", () => {
    expect(secretFromEnv(cert.replace(/\n/g, "\\n"), "-----BEGIN")).toBe(cert);
  });
  it("accepts base64", () => {
    expect(secretFromEnv(Buffer.from(cert).toString("base64"), "-----BEGIN")).toBe(cert);
  });
  it("accepts a file path", () => {
    const file = join(fx.dir, "inline.pem");
    writeFileSync(file, cert);
    expect(secretFromEnv(file, "-----BEGIN")).toBe(cert);
  });
  it("accepts base64 JSON for the Google service account", () => {
    expect(JSON.parse(secretFromEnv(Buffer.from(fx.googleSa).toString("base64"), "{")).client_email).toBe("wallet@test.iam.gserviceaccount.com");
  });
});

describe("whereLabel", () => {
  it("names the venue and city, or Online", () => {
    expect(whereLabel(ticket)).toBe("The Hall, Lisbon");
    expect(whereLabel({ ...ticket, locationType: "online" })).toBe("Online");
    expect(whereLabel({ ...ticket, venueName: null, city: null })).toBe("See event page");
  });
});

describe("Apple Wallet pass", () => {
  it.skipIf(!fx.openssl)("builds a signed .pkpass bundle from certs given as path, base64 and inline", async () => {
    const pkpass = await buildApplePass(ticket);
    expect(pkpass.subarray(0, 2).toString()).toBe("PK"); // zip
    const names = pkpass.toString("latin1");
    for (const entry of ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "icon@3x.png"]) expect(names).toContain(entry);
  }, 20_000);
});

describe("Google Wallet save link", () => {
  it("signs a JWT carrying the class and object, verifiable with the service account key", async () => {
    const url = await googleWalletSaveUrl(ticket);
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const key = await importSPKI(fx.googlePublicPem, "RS256");
    const { payload } = await jwtVerify(url.split("/save/")[1]!, key, { audience: "google" });
    expect(payload.iss).toBe("wallet@test.iam.gserviceaccount.com");
    expect(payload.typ).toBe("savetowallet");
    expect(payload.origins).toEqual(["https://evnelo.test"]);
    const body = payload.payload as { eventTicketClasses: Array<Record<string, unknown>>; eventTicketObjects: Array<Record<string, unknown>> };
    expect(body.eventTicketClasses[0]!.id).toBe("3388000000012345678.event_ev_1");
    expect(body.eventTicketObjects[0]!).toMatchObject({ id: "3388000000012345678.ticket_tk_1", classId: "3388000000012345678.event_ev_1", ticketHolderName: "Ada Lovelace", state: "ACTIVE" });
    expect((body.eventTicketObjects[0]!.barcode as { value: string }).value).toBe("https://evnelo.test/t/tok");
  });
});
