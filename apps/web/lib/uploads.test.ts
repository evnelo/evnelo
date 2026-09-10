import { describe, expect, it } from "vitest";
import { access, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { cleanupOrganizationUploads, hasTrustedRequestOrigin, processImageUpload, readBoundedRequestBody, uploadDirectory, uploadedImageOwner, uploadedImagePath, validateImageUpload } from "./uploads";

describe("image uploads", () => {
  it("decodes and re-encodes supported images as bounded WebP", async () => {
    const pngBytes = await sharp({ create: { width: 1, height: 1, channels: 4, background: "#ffffff" } }).png().toBuffer();
    const file = new File([pngBytes], "cover.png", { type: "image/png" });
    const output = await processImageUpload(file);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
  });

  it("rejects unsupported, malformed, and oversized files", async () => {
    expect(() => validateImageUpload(new File(["svg"], "cover.svg", { type: "image/svg+xml" }))).toThrow("JPEG, PNG, or WebP");
    expect(() => validateImageUpload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" }))).toThrow("5 MB");
    await expect(processImageUpload(new File(["not an image"], "fake.png", { type: "image/png" }))).rejects.toThrow("valid supported image");
  });

  it("rejects files whose bytes are not JPEG, PNG or WebP even when the declared type is", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>';
    await expect(processImageUpload(new File([svg], "cover.png", { type: "image/png" }))).rejects.toThrow("JPEG, PNG, or WebP");
  });

  it("defaults storage under the working directory and refuses unsafe filenames", () => {
    const orgId = "01J00000000000000000000000";
    const filename = `${orgId}-${"a".repeat(32)}.webp`;
    expect(uploadDirectory()).toBe(`${process.cwd()}/uploads`);
    expect(uploadDirectory("/var/lib/openticket/uploads")).toBe("/var/lib/openticket/uploads");
    expect(uploadedImageOwner(filename)).toBe(orgId);
    expect(uploadedImagePath(filename, "/var/lib/openticket/uploads")).toBe(`/var/lib/openticket/uploads/${filename}`);
    expect(uploadedImagePath("../secret.webp", "/var/lib/openticket/uploads")).toBeNull();
  });

  it("fails closed on missing or untrusted upload origins", () => {
    const expected = "https://tickets.example";
    expect(hasTrustedRequestOrigin(new Request("https://tickets.example/api/uploads"), expected)).toBe(false);
    expect(hasTrustedRequestOrigin(new Request("https://tickets.example/api/uploads", { headers: { Origin: "https://evil.example" } }), expected)).toBe(false);
    expect(hasTrustedRequestOrigin(new Request("https://tickets.example/api/uploads", { headers: { Origin: expected } }), expected)).toBe(true);
    expect(hasTrustedRequestOrigin(new Request("https://tickets.example/api/uploads", { headers: { Referer: `${expected}/dashboard` } }), expected)).toBe(true);
  });

  it("stops reading request bodies at the route-specific limit", async () => {
    const request = new Request("https://example.test/api/uploads", { method: "POST", body: new Uint8Array(9) });
    await expect(readBoundedRequestBody(request, 8)).rejects.toThrow("too large");
  });

  it("removes old unreferenced uploads but preserves referenced and recent files", async () => {
    const directory = "/tmp/hermes-verify-upload-cleanup";
    const orgId = "01J00000000000000000000000";
    const oldOrphan = `${orgId}-${"a".repeat(32)}.webp`;
    const oldReferenced = `${orgId}-${"b".repeat(32)}.webp`;
    const recentOrphan = `${orgId}-${"c".repeat(32)}.webp`;
    await mkdir(directory, { recursive: true });
    for (const filename of [oldOrphan, oldReferenced, recentOrphan]) await writeFile(`${directory}/${filename}`, "image");
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(`${directory}/${oldOrphan}`, old, old);
    await utimes(`${directory}/${oldReferenced}`, old, old);
    await cleanupOrganizationUploads(directory, orgId, new Set([oldReferenced]), new Date("2021-01-01T00:00:00Z"));
    await expect(access(`${directory}/${oldOrphan}`)).rejects.toThrow();
    await expect(access(`${directory}/${oldReferenced}`)).resolves.toBeUndefined();
    await expect(access(`${directory}/${recentOrphan}`)).resolves.toBeUndefined();
    await rm(directory, { recursive: true, force: true });
  });
});
