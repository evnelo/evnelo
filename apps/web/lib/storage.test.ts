import { describe, expect, it } from "vitest";
import { IMAGE_TYPES, publicUrl, uploadKey } from "./storage";

describe("S3 storage helpers", () => {
  it("prefers CloudFront, then a custom endpoint, then the bucket address", () => {
    expect(publicUrl("uploads/o/x.jpg", { cloudfrontDomain: "https://cdn.example.com/", bucket: "b", region: "us-east-1" })).toBe("https://cdn.example.com/uploads/o/x.jpg");
    expect(publicUrl("uploads/o/x.jpg", { cloudfrontDomain: "cdn.example.com", bucket: "b", region: "us-east-1" })).toBe("https://cdn.example.com/uploads/o/x.jpg");
    expect(publicUrl("uploads/o/x.jpg", { endpoint: "https://accountid.r2.cloudflarestorage.com", bucket: "b", region: "auto" })).toBe("https://accountid.r2.cloudflarestorage.com/b/uploads/o/x.jpg");
    expect(publicUrl("uploads/o/x.jpg", { bucket: "b", region: "eu-west-1" })).toBe("https://b.s3.eu-west-1.amazonaws.com/uploads/o/x.jpg");
  });

  it("namespaces keys by organization with a random name and the right extension", () => {
    const key = uploadKey("01J00000000000000000000000", "image/png");
    expect(key).toMatch(/^openticket\/uploads\/01J00000000000000000000000\/[a-f0-9]{32}\.png$/);
    expect(uploadKey("o", "image/jpeg")).toMatch(/\.jpg$/);
    expect(Object.keys(IMAGE_TYPES)).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
