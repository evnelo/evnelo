import { describe, expect, it } from "vitest";
import { ERASED_NAME, erasedEmail, eventReportInput } from "../services/privacy";

describe("privacy helpers", () => {
  it("produces stable, non-deliverable placeholders", () => {
    expect(erasedEmail("01ABC")).toBe("erased-01abc@anonymized.invalid");
    expect(ERASED_NAME).toBe("Deleted attendee");
  });
  it("validates abuse reports", () => {
    expect(eventReportInput.safeParse({ eventId: "01AAAAAAAAAAAAAAAAAAAAAAAA", reason: "spam" }).success).toBe(true);
    expect(eventReportInput.safeParse({ eventId: "short", reason: "spam" }).success).toBe(false);
    expect(eventReportInput.safeParse({ eventId: "01AAAAAAAAAAAAAAAAAAAAAAAA", reason: "rude" }).success).toBe(false);
    expect(eventReportInput.parse({ eventId: "01AAAAAAAAAAAAAAAAAAAAAAAA", reason: "other", reporterEmail: " A@B.CO " }).reporterEmail).toBe("a@b.co");
  });
});
