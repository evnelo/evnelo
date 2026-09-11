import { describe, expect, it } from "vitest";
import {
  isRegistrationFileKey,
  parseRegistrationFileKey,
  registrationFileDownloadPath,
  registrationFileExtension,
  registrationFileKey,
  registrationFilePrefix,
} from "../fields/files";
import { buildAnswersSchema } from "../fields/schema";

const EVENT = "01J8ZK7V4T9QF2M6X0RHB3NCDE";
const OTHER = "01J8ZK7V4T9QF2M6X0RHB3NCDF";
const NAME = "a".repeat(32);
const KEY = `openticket/registrations/${EVENT}/${NAME}.pdf`;

describe("registration file keys", () => {
  it("builds and parses an event-scoped key", () => {
    expect(registrationFilePrefix("openticket", EVENT)).toBe(`openticket/registrations/${EVENT}/`);
    expect(registrationFileKey("openticket", EVENT, NAME, "pdf")).toBe(KEY);
    expect(parseRegistrationFileKey(KEY)).toEqual({ key: KEY, keyPrefix: "openticket", eventId: EVENT, name: NAME, extension: "pdf" });
  });

  it("accepts a shared multi-segment bucket prefix and trims slashes", () => {
    expect(registrationFileKey("/shared/ot/", EVENT, NAME, "png")).toBe(`shared/ot/registrations/${EVENT}/${NAME}.png`);
    expect(parseRegistrationFileKey(`shared/ot/registrations/${EVENT}/${NAME}.png`)?.keyPrefix).toBe("shared/ot");
  });

  it("binds a key to its event and, when asked, to the configured prefix", () => {
    expect(isRegistrationFileKey(KEY, EVENT)).toBe(true);
    expect(isRegistrationFileKey(KEY, OTHER)).toBe(false);
    expect(isRegistrationFileKey(KEY)).toBe(true);
    expect(parseRegistrationFileKey(KEY, { keyPrefix: "openticket" })).not.toBeNull();
    expect(parseRegistrationFileKey(KEY, { keyPrefix: "/openticket/" })).not.toBeNull();
    expect(parseRegistrationFileKey(KEY, { keyPrefix: "someone-else" })).toBeNull();
  });

  it("rejects traversal, the public prefix, wrong extensions and non-strings", () => {
    for (const bad of [
      `openticket/registrations/${EVENT}/../../uploads/secret.pdf`,
      `../registrations/${EVENT}/${NAME}.pdf`,
      `openticket/uploads/${EVENT}/${NAME}.pdf`,
      `/openticket/registrations/${EVENT}/${NAME}.pdf`,
      `openticket/registrations/${EVENT}/${NAME}.exe`,
      `openticket/registrations/${EVENT}/${NAME.toUpperCase()}.pdf`,
      `openticket/registrations/short/${NAME}.pdf`,
      `https://cdn.example.com/openticket/registrations/${EVENT}/${NAME}.pdf`,
      "",
      null,
      42,
    ]) {
      expect(isRegistrationFileKey(bad)).toBe(false);
    }
  });

  it("maps only the allowed content types to extensions", () => {
    expect(registrationFileExtension("application/pdf")).toBe("pdf");
    expect(registrationFileExtension("image/jpeg; charset=binary")).toBe("jpg");
    expect(registrationFileExtension("IMAGE/PNG")).toBe("png");
    expect(registrationFileExtension("image/svg+xml")).toBeNull();
    expect(registrationFileExtension("text/html")).toBeNull();
  });

  it("routes downloads through the authenticated dashboard path", () => {
    expect(registrationFileDownloadPath(KEY)).toBe(`/api/uploads/registration/${EVENT}/${NAME}.pdf`);
    expect(registrationFileDownloadPath(`shared/ot/registrations/${EVENT}/${NAME}.png`)).toBe(`/api/uploads/registration/${EVENT}/${NAME}.png`);
    expect(registrationFileDownloadPath("https://cdn.example.com/x.pdf")).toBeNull();
  });
});

describe("file answers", () => {
  const field = (required: boolean) => [{
    eventId: EVENT, key: "cv", label: "CV", type: "file", required, options: null, condition: null, position: 0, scope: "attendee", ticketTypeIds: null,
  }] as never[];

  it("accepts a key for this event and rejects URLs or other events", () => {
    const schema = buildAnswersSchema(field(true), { scope: "attendee" });
    expect(schema.safeParse({ cv: KEY }).success).toBe(true);
    expect(schema.safeParse({ cv: `openticket/registrations/${OTHER}/${NAME}.pdf` }).success).toBe(false);
    expect(schema.safeParse({ cv: "https://example.com/cv.pdf" }).success).toBe(false);
    expect(schema.safeParse({ cv: "" }).success).toBe(false);
  });

  it("lets an optional file field stay empty", () => {
    const schema = buildAnswersSchema(field(false), { scope: "attendee" });
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ cv: "" }).success).toBe(true);
    expect(schema.safeParse({ cv: "not-a-key" }).success).toBe(false);
    expect(schema.parse({ cv: KEY })).toEqual({ cv: KEY });
  });
});
