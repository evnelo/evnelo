import { createHash } from "node:crypto";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * Vonage signs webhooks with a JWT (HS256, the account's signature secret) whose
 * payload_hash is the SHA-256 of the raw body. Verification is on when the secret is set;
 * without it the endpoint trusts the network, which is acceptable only behind a firewall.
 */
export async function verifyVonage(req: Request, body: string): Promise<boolean> {
  if (!env.VONAGE_SIGNATURE_SECRET) return true;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.VONAGE_SIGNATURE_SECRET), { algorithms: ["HS256"] });
    return payload.payload_hash === createHash("sha256").update(body).digest("hex");
  } catch {
    return false;
  }
}
