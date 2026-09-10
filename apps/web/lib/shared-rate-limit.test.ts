import { describe, expect, it } from "vitest";
import { rateLimitWindowStart, sharedRateLimitBucket } from "./shared-rate-limit";

describe("shared rate limit", () => {
  it("creates stable, scope-specific database bucket IDs", () => {
    const upload = sharedRateLimitBucket("upload", "user-1");
    expect(upload).toHaveLength(26);
    expect(upload).toBe(sharedRateLimitBucket("upload", "user-1"));
    expect(upload).not.toBe(sharedRateLimitBucket("geocode", "user-1"));
  });

  it("rounds timestamps down to the shared window", () => {
    expect(rateLimitWindowStart(new Date("2026-09-09T22:44:59.999Z"), 60_000).toISOString()).toBe("2026-09-09T22:44:00.000Z");
  });
});
