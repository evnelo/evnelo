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
    expect(r.key).toMatch(/^openticket\/uploads\/01J00000000000000000000000\/[a-f0-9]{32}\.png$/);
    expect(r.fields.key).toBe(r.key);
    expect(r.fields["Content-Type"]).toBe("image/png");
    const policy = JSON.parse(Buffer.from(r.fields.Policy!, "base64").toString("utf8")) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 5 * 1024 * 1024]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "image/png"]);
    expect(policy.conditions).toContainEqual(["starts-with", "$key", "openticket/uploads/01J00000000000000000000000/"]);
    expect(r.publicUrl).toBe(`https://cdn.example.com/${r.key}`);
    expect(keyFromPublicUrl(r.publicUrl)).toBe(r.key);
    expect(keyFromPublicUrl("https://elsewhere.example/x.png")).toBeNull();
  });

  it("accepts the S3_* credential names and a custom key prefix", async () => {
    const before = { ...process.env };
    for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]) delete process.env[k];
    Object.assign(process.env, { S3_ACCESS_KEY_ID: "AKIAS3", S3_SECRET_ACCESS_KEY: "secret2", S3_REGION: "eu-west-1", S3_KEY_PREFIX: "/shared/ot/" });
    vi.resetModules();
    try {
      const { presignImageUpload, storageConfigured, uploadPrefix } = await import("./storage");
      expect(storageConfigured).toBe(true);
      expect(uploadPrefix("org1")).toBe("shared/ot/uploads/org1/");
      const r = await presignImageUpload("org1", "image/jpeg");
      expect(r.url).toBe("https://ot-test.s3.eu-west-1.amazonaws.com/");
      expect(r.key).toMatch(/^shared\/ot\/uploads\/org1\/[a-f0-9]{32}\.jpg$/);
      expect(r.fields["X-Amz-Credential"]).toMatch(/^AKIAS3\//);
    } finally {
      process.env = { ...before };
      vi.resetModules();
    }
  });
});
