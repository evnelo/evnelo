import { describe, expect, it } from "vitest";
import { planRegistrationUpload } from "./registration-uploads";

const EVENT = "01J00000000000000000000000";
const plan = (contentType: string, size = 1024, eventId = EVENT) => planRegistrationUpload({ eventId, contentType, size });

describe("planning a registration upload", () => {
  it("accepts only PDF, JPEG, PNG and WebP", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp"]) {
      expect(plan(type)).toEqual({ ok: true, eventId: EVENT, contentType: type });
    }
    for (const type of ["image/svg+xml", "text/html", "application/zip", "application/octet-stream", "image/gif"]) {
      expect(plan(type)).toMatchObject({ ok: false, status: 415 });
    }
  });

  it("normalises the content type the browser reports", () => {
    expect(plan("IMAGE/JPEG; charset=binary")).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(plan("  application/pdf  ")).toMatchObject({ ok: true, contentType: "application/pdf" });
  });

  it("refuses empty files and anything over 10 MB", () => {
    expect(plan("application/pdf", 0)).toMatchObject({ ok: false, status: 400 });
    expect(plan("application/pdf", -1)).toMatchObject({ ok: false, status: 400 });
    expect(plan("application/pdf", Number.NaN)).toMatchObject({ ok: false, status: 400 });
    expect(plan("application/pdf", 10 * 1024 * 1024)).toMatchObject({ ok: true });
    expect(plan("application/pdf", 10 * 1024 * 1024 + 1)).toMatchObject({ ok: false, status: 413 });
  });

  it("refuses an event id that is not a plain ULID", () => {
    for (const eventId of ["../other", "01J0000000000000000000000", "01J00000000000000000000000x", "evnelo/registrations"]) {
      expect(plan("application/pdf", 10, eventId)).toMatchObject({ ok: false, status: 400 });
    }
  });
});
