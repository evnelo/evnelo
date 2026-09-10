import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { GET } from "./route";

const directory = "/tmp/hermes-verify-openticket-uploads";
const orgId = "01J00000000000000000000000";
const filename = `${orgId}-${"a".repeat(32)}.webp`;

beforeAll(async () => {
  process.env.UPLOAD_DIR = directory;
  const { env } = await import("@/lib/env");
  (env as { UPLOAD_DIR?: string }).UPLOAD_DIR = directory;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/${filename}`, new Uint8Array([0x52, 0x49, 0x46, 0x46]));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

describe("uploaded images", () => {
  it("serves safe generated filenames with hardened immutable headers", async () => {
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ filename }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("answers a matching If-None-Match with 304", async () => {
    const response = await GET(new Request("https://example.test", { headers: { "if-none-match": `"${filename.replace(/\.webp$/, "")}"` } }), { params: Promise.resolve({ filename }) });
    expect(response.status).toBe(304);
  });

  it("rejects unsafe filenames", async () => {
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ filename: "../secret.webp" }) });
    expect(response.status).toBe(404);
  });
});
