import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Presigning is local signing, so it can be exercised without a bucket. */
describe("presigned S3 uploads", () => {
  const saved = { ...process.env };
  beforeAll(() => {
    // the root .env may carry real S3_* values; this case exercises the AWS_* names and no ACL
    for (const k of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_REGION", "S3_UPLOAD_ACL", "S3_KEY_PREFIX", "S3_ENDPOINT"]) delete process.env[k];
    Object.assign(process.env, { AWS_ACCESS_KEY_ID: "AKIATEST", AWS_SECRET_ACCESS_KEY: "secret", AWS_REGION: "us-east-1", S3_BUCKET: "evnelo-test", CLOUDFRONT_DOMAIN: "cdn.example.com" });
    vi.resetModules();
  });
  afterAll(() => { process.env = { ...saved }; vi.resetModules(); });

  it("pins the organization prefix, content type and size in the policy and returns the CloudFront URL", async () => {
    const { presignImageUpload, storageConfigured, keyFromPublicUrl } = await import("./storage");
    expect(storageConfigured).toBe(true);
    const r = await presignImageUpload("01J00000000000000000000000", "image/png");
    expect(r.url).toBe("https://evnelo-test.s3.us-east-1.amazonaws.com/");
    expect(r.key).toMatch(/^evnelo\/uploads\/01J00000000000000000000000\/[a-f0-9]{32}\.png$/);
    expect(r.fields.key).toBe(r.key);
    expect(r.fields["Content-Type"]).toBe("image/png");
    const policy = JSON.parse(Buffer.from(r.fields.Policy!, "base64").toString("utf8")) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 5 * 1024 * 1024]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "image/png"]);
    expect(policy.conditions).toContainEqual(["starts-with", "$key", "evnelo/uploads/01J00000000000000000000000/"]);
    expect(r.fields.acl).toBeUndefined();
    expect(policy.conditions.some((c) => JSON.stringify(c).includes("acl"))).toBe(false);
    expect(r.publicUrl).toBe(`https://cdn.example.com/${r.key}`);
    expect(keyFromPublicUrl(r.publicUrl)).toBe(r.key);
    expect(keyFromPublicUrl("https://elsewhere.example/x.png")).toBeNull();
  });

  it("accepts the S3_* credential names, a custom key prefix and an upload ACL", async () => {
    const before = { ...process.env };
    for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]) delete process.env[k];
    Object.assign(process.env, { S3_ACCESS_KEY_ID: "AKIAS3", S3_SECRET_ACCESS_KEY: "secret2", S3_REGION: "eu-west-1", S3_KEY_PREFIX: "/shared/ot/", S3_UPLOAD_ACL: "public-read" });
    vi.resetModules();
    try {
      const { presignImageUpload, storageConfigured, uploadPrefix } = await import("./storage");
      expect(storageConfigured).toBe(true);
      expect(uploadPrefix("org1")).toBe("shared/ot/uploads/org1/");
      const r = await presignImageUpload("org1", "image/jpeg");
      expect(r.url).toBe("https://evnelo-test.s3.eu-west-1.amazonaws.com/");
      expect(r.key).toMatch(/^shared\/ot\/uploads\/org1\/[a-f0-9]{32}\.jpg$/);
      expect(r.fields["X-Amz-Credential"]).toMatch(/^AKIAS3\//);
      expect(r.fields.acl).toBe("public-read");
      const policy = JSON.parse(Buffer.from(r.fields.Policy!, "base64").toString("utf8")) as { conditions: unknown[] };
      expect(policy.conditions).toContainEqual({ acl: "public-read" });
    } finally {
      process.env = { ...before };
      vi.resetModules();
    }
  });
});

/** Registration answers are private: same signing path, deliberately different policy. */
describe("presigned registration uploads", () => {
  const saved = { ...process.env };
  const EVENT = "01J00000000000000000000000";
  beforeAll(() => {
    for (const k of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_REGION", "S3_ENDPOINT"]) delete process.env[k];
    // an upload ACL is configured for images; the registration policy must still refuse to use it
    Object.assign(process.env, {
      AWS_ACCESS_KEY_ID: "AKIATEST", AWS_SECRET_ACCESS_KEY: "secret", AWS_REGION: "us-east-1",
      S3_BUCKET: "evnelo-test", CLOUDFRONT_DOMAIN: "cdn.example.com", S3_UPLOAD_ACL: "public-read", S3_KEY_PREFIX: "evnelo",
    });
    vi.resetModules();
  });
  afterAll(() => { process.env = { ...saved }; vi.resetModules(); });

  it("pins one key, the content type and a 10 MB ceiling, and never grants an ACL", async () => {
    const { presignRegistrationUpload, registrationUploadPrefix } = await import("./storage");
    expect(registrationUploadPrefix(EVENT)).toBe(`evnelo/registrations/${EVENT}/`);
    const r = await presignRegistrationUpload(EVENT, "application/pdf");
    expect(r.url).toBe("https://evnelo-test.s3.us-east-1.amazonaws.com/");
    expect(r.key).toMatch(new RegExp(`^evnelo/registrations/${EVENT}/[a-f0-9]{32}\\.pdf$`));
    expect(r.fields.key).toBe(r.key);
    expect(r.fields["Content-Type"]).toBe("application/pdf");
    const policy = JSON.parse(Buffer.from(r.fields.Policy!, "base64").toString("utf8")) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 10 * 1024 * 1024]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "application/pdf"]);
    expect(policy.conditions).toContainEqual(["eq", "$key", r.key]);
    // no `starts-with` on the key and no public-read anywhere: one signature buys one private object
    expect(policy.conditions.some((c) => JSON.stringify(c).includes("starts-with"))).toBe(false);
    expect(policy.conditions.some((c) => JSON.stringify(c).includes("acl"))).toBe(false);
    expect(r.fields.acl).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("cdn.example.com"); // never a public URL
  });

  it("gives every allowed type its own extension and a fresh key", async () => {
    const { presignRegistrationUpload } = await import("./storage");
    for (const [type, extension] of [["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]] as const) {
      expect((await presignRegistrationUpload(EVENT, type)).key).toMatch(new RegExp(`\\.${extension}$`));
    }
    const [a, b] = await Promise.all([presignRegistrationUpload(EVENT, "image/png"), presignRegistrationUpload(EVENT, "image/png")]);
    expect(a.key).not.toBe(b.key);
  });

  it("honours a shared bucket prefix", async () => {
    const before = { ...process.env };
    process.env.S3_KEY_PREFIX = "/shared/ot/";
    vi.resetModules();
    try {
      const { presignRegistrationUpload } = await import("./storage");
      expect((await presignRegistrationUpload(EVENT, "image/png")).key).toMatch(new RegExp(`^shared/ot/registrations/${EVENT}/[a-f0-9]{32}\\.png$`));
    } finally {
      process.env = { ...before };
      vi.resetModules();
    }
  });

  it("rejects a foreign event, prefix, folder or extension before any HEAD is attempted", async () => {
    const { verifyRegistrationFile } = await import("./storage");
    const name = "a".repeat(32);
    expect(await verifyRegistrationFile(`evnelo/registrations/01J00000000000000000000001/${name}.pdf`, EVENT)).toBeNull();
    expect(await verifyRegistrationFile(`someone-else/registrations/${EVENT}/${name}.pdf`, EVENT)).toBeNull();
    expect(await verifyRegistrationFile(`evnelo/uploads/${EVENT}/${name}.pdf`, EVENT)).toBeNull();
    expect(await verifyRegistrationFile(`evnelo/registrations/${EVENT}/${name}.exe`, EVENT)).toBeNull();
    expect(await verifyRegistrationFile(null, EVENT)).toBeNull();
  });
});
