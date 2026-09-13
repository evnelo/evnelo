import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECT_COOKIE, signConnectState } from "@/lib/stripe-connect-state";

const mocks = vi.hoisted(() => ({ cookie: "", user: { id: "user-a" } as { id: string } | null, membership: vi.fn(), bind: vi.fn(), claim: vi.fn(), token: vi.fn(), retrieve: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => name === CONNECT_COOKIE ? { value: mocks.cookie } : { value: "org-switched" } }) }));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://evnelo.test", AUTH_SECRET: "test-oauth-secret", STRIPE_SECRET_KEY: "sk_live_test" } }));
vi.mock("@/lib/auth/session", () => ({ currentUser: async () => mocks.user, ORG_COOKIE: "ev_org" }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@evnelo/core/services", () => ({ getMembership: mocks.membership, connectOrganizationStripe: mocks.bind }));
vi.mock("@/lib/shared-rate-limit", () => ({ consumeSharedRateLimit: mocks.claim }));
vi.mock("@/lib/stripe", () => ({ stripe: { oauth: { token: mocks.token }, accounts: { retrieve: mocks.retrieve } } }));
vi.mock("@/lib/stripe-connect", () => ({ stripeConnectConfigured: true }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
import { GET } from "./route";

describe("Stripe OAuth callback", () => {
  let state: string;
  const call = (query = "code=ac_test") => GET(new Request(`https://untrusted.test/api/stripe/connect/callback?state=${state}&${query}`));
  const outcome = (response: Response) => new URL(response.headers.get("location")!).searchParams.get("connect");

  beforeEach(async () => {
    vi.resetAllMocks();
    mocks.user = { id: "user-a" };
    const signed = await signConnectState("org-original", "user-a", "test-oauth-secret");
    mocks.cookie = signed.cookie;
    state = signed.state;
    mocks.membership.mockResolvedValue("owner");
    mocks.claim.mockResolvedValue(true);
    mocks.bind.mockResolvedValue(true);
    mocks.token.mockResolvedValue({ stripe_user_id: "acct_connected", scope: "read_write", livemode: true });
    mocks.retrieve.mockResolvedValue({ id: "acct_connected", charges_enabled: true });
  });

  it("binds the original organization after an org switch and redirects to the configured origin", async () => {
    const response = await call();
    expect(outcome(response)).toBe("success");
    expect(new URL(response.headers.get("location")!).origin).toBe("https://evnelo.test");
    expect(mocks.bind).toHaveBeenCalledWith({}, "org-original", "user-a", "acct_connected", true);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("ev_org=org-original");
  });

  it.each(["missing-cookie", "wrong-state", "other-user", "signed-out", "permission-lost", "replay"])("rejects %s before the token exchange", async (scenario) => {
    if (scenario === "missing-cookie") mocks.cookie = "";
    if (scenario === "wrong-state") state = "wrong";
    if (scenario === "other-user") mocks.user = { id: "other" };
    if (scenario === "signed-out") mocks.user = null;
    if (scenario === "permission-lost") mocks.membership.mockResolvedValue("member");
    if (scenario === "replay") mocks.claim.mockResolvedValue(false);
    expect(outcome(await call())).toBe("invalid");
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it("handles denial and missing codes without calling Stripe", async () => {
    expect(outcome(await call("error=access_denied"))).toBe("cancelled");
    expect(outcome(await call(""))).toBe("invalid");
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it.each([{ livemode: false, scope: "read_write" }, { livemode: true, scope: "read_only" }])("rejects a mismatched OAuth mode or scope: %j", async (token) => {
    mocks.token.mockResolvedValue({ stripe_user_id: "acct_connected", ...token });
    expect(outcome(await call())).toBe("failed");
    expect(mocks.bind).not.toHaveBeenCalled();
  });

  it("handles exchange failures and refuses replacing another account", async () => {
    mocks.token.mockRejectedValueOnce(new Error("Bad code"));
    expect(outcome(await call())).toBe("failed");
    mocks.bind.mockResolvedValue(false);
    expect(outcome(await call())).toBe("failed");
  });
});
