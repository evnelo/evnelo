import { createDb } from "@evnelo/db";
import { DelegatedOAuth } from "../../services/oauth";

// Independent process/pool; fixture secrets arrive on stdin, never argv or stdout.
try {
  let input = "";
  for await (const chunk of process.stdin) input += String(chunk);
  const request = JSON.parse(input);
  const url = process.env.MCP_OAUTH_TEST_DATABASE_URL;
  if (!url || new URL(url).hostname !== "127.0.0.1" || new URL(url).port !== "3311" || new URL(url).pathname !== "/evnelo") throw new Error("Wrong fixture");
  const engine = new DelegatedOAuth({ issuer: request.issuer, resource: request.resource, clock: () => new Date(request.now) });
  const authority = await engine.validateAccess(createDb(url), { token: request.token, clientId: request.clientId, resource: request.resource, scopes: request.scopes });
  if (authority.userId !== request.userId) throw new Error("Persistence failed");
  process.stdout.write(JSON.stringify({ persistedAuthorityValid: true }));
  process.exit(0);
} catch {
  process.stderr.write("Independent OAuth persistence probe failed\n");
  process.exit(1);
}
