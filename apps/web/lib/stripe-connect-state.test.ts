import { describe, expect, it } from "vitest";
import { CONNECT_MAX_AGE, signConnectState, verifyConnectState } from "./stripe-connect-state";

const secret = "stripe-connect-test-secret-long-enough";

describe("Stripe OAuth state", () => {
  it("binds a random state to the initiating user and organization", async () => {
    const first = await signConnectState("org-a", "user-a", secret);
    const second = await signConnectState("org-a", "user-a", secret);
    expect(first.state).not.toBe(second.state);
    await expect(verifyConnectState(first.cookie, first.state, "user-a", secret)).resolves.toMatchObject({ orgId: "org-a", userId: "user-a" });
    await expect(verifyConnectState(first.cookie, second.state, "user-a", secret)).rejects.toThrow();
    await expect(verifyConnectState(first.cookie, first.state, "user-b", secret)).rejects.toThrow();
  });

  it("rejects forgery, missing state and expiry", async () => {
    const { cookie, state } = await signConnectState("org-a", "user-a", secret);
    await expect(verifyConnectState(cookie, state, "user-a", "another-secret")).rejects.toThrow();
    await expect(verifyConnectState(cookie, "", "user-a", secret)).rejects.toThrow();
    await expect(verifyConnectState(cookie, state, "user-a", secret, new Date(Date.now() + (CONNECT_MAX_AGE + 1) * 1000))).rejects.toThrow();
  });
});
