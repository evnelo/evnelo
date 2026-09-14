import { describe, expect, it } from "vitest";
import { STALE_UPLOAD_MS, claimRegistrationUploads } from "../services/uploads";

describe("registration upload tracking", () => {
  it("claims nothing without keys and never touches the database for it", async () => {
    const db = { delete: () => { throw new Error("should not be called"); } };
    expect(await claimRegistrationUploads(db as never, [])).toBe(0);
  });
  it("gives an abandoned form a full day before its file is swept", () => {
    expect(STALE_UPLOAD_MS).toBe(86_400_000);
  });
});
