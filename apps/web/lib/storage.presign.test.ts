import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Presigning is local signing, so it can be exercised without a bucket. */
describe("presigned S3 uploads", () => {
  const saved = { ...process.env };
  beforeAll(() => {
    Object.assign(process.env, { AWS_ACCESS_KEY_ID: "AKIATEST", AWS_SECRET_ACCESS_KEY: "secret", AWS_REGION: "us-east-1", S3_BUCKET: "ot-test", CLOUDFRONT_DOMAIN: "cdn.example.com" });
    vi.resetModules();
  });
  afterAll(() => { process.env = { ...saved }; vi.resetModules(); });

  it("pins the organization prefix, content type and size in the policy and returns the CloudFront URL", async () => {
    const { presignImageUpload, storageConfigured, keyFromPublicUrl } = await import("./storage");
    expect(storageConfigured).toBe(true);
    const r = await presignImageUpload("01J00000000000000000000000", "image/png");
    expect(r.url).toBe("https://ot-test.s3.us-east-1.amazonaws.com/");
    expect(r.key).toMatch(/^uploads\/01J00000000000000000000000\/[a-f0-9]{32}\.png$/);
    expect(r.fields.key).toBe(r.key);
    expect(r.fields["Content-Type"]).toBe("image/png");
    const policy = JSON.parse(Buffer.from(r.fields.Policy!, "base64").toString("utf8")) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 5 * 1024 * 1024]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "image/png"]);
    expect(policy.conditions).toContainEqual(["starts-with", "$key", "uploads/01J00000000000000000000000/"]);
    expect(r.publicUrl).toBe(`https://cdn.example.com/${r.key}`);
    expect(keyFromPublicUrl(r.publicUrl)).toBe(r.key);
    expect(keyFromPublicUrl("https://elsewhere.example/x.png")).toBeNull();
  });
});
