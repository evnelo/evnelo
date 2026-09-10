import { afterEach, describe, expect, it, vi } from "vitest";

const originalAuthUrl = process.env.AUTH_URL;
const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAuthUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = originalAuthUrl;
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Next.js environment setup", () => {
  it("uses APP_URL as the Auth.js public origin when AUTH_URL is not explicit", async () => {
    delete process.env.AUTH_URL;
    process.env.APP_URL = "https://openticket.example.test";
    vi.resetModules();

    await import("./next.config");

    expect(process.env.AUTH_URL).toBe("https://openticket.example.test");
  });

  it("preserves an explicit AUTH_URL", async () => {
    process.env.APP_URL = "https://openticket.example.test";
    process.env.AUTH_URL = "https://auth.example.test";
    vi.resetModules();

    await import("./next.config");

    expect(process.env.AUTH_URL).toBe("https://auth.example.test");
  });

  it("leaves AUTH_URL unset when APP_URL is unavailable", async () => {
    vi.spyOn(process, "loadEnvFile").mockImplementation(() => {
      throw new Error("No environment file");
    });
    delete process.env.AUTH_URL;
    delete process.env.APP_URL;
    vi.resetModules();

    await import("./next.config");

    expect(process.env.AUTH_URL).toBeUndefined();
  });
});
