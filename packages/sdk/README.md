# @evnelo/sdk

Typed TypeScript client for the Evnelo REST API (`/api/v1`), generated from the same OpenAPI document the server publishes at `/api/v1/openapi.json`. Built on [openapi-fetch](https://openapi-ts.dev/openapi-fetch/): every path, parameter, request body and response is typed from `src/schema.d.ts`, so a wrong path or a missing field is a compile error.

```ts
import { createEvneloClient } from "@evnelo/sdk";

const client = createEvneloClient({ baseUrl: "https://tickets.example.com", apiKey: process.env.EVNELO_API_KEY });

const { data, error } = await client.GET("/events", { params: { query: { status: "published" } } });
if (error) throw new Error(`${error.error.code}: ${error.error.message}`);
for (const { event, registrations } of data.data) console.log(event.name, registrations);

await client.POST("/events/{id}/ticket-types", {
  params: { path: { id: eventId } },
  body: { name: "Early bird", priceMinor: 2500, currency: "USD", quantity: 100 },
  headers: { "Idempotency-Key": crypto.randomUUID() },
});

const csv = await client.GET("/events/{id}/attendees/export.csv", { params: { path: { id: eventId } }, parseAs: "text" });
```

Responses are `{ data, error, response }`; list endpoints return `{ data, pagination: { limit, offset, nextOffset } }`. Send `Idempotency-Key` on writes you may retry.

## Webhooks

`verifyWebhookSignature(secret, timestamp, rawBody, signature)` and `verifyWebhookRequest(secret, headers, rawBody)` check the `evnelo-signature` header (HMAC-SHA256 over `{timestamp}.{body}`, 5-minute replay window) with the secret returned once when the webhook was created. Pass the raw body bytes as received; re-serializing changes the signature.

```ts
import { verifyWebhookRequest } from "@evnelo/sdk";

export async function POST(request: Request) {
  const envelope = verifyWebhookRequest(process.env.WEBHOOK_SECRET!, request.headers, await request.text());
  if (!envelope) return new Response("bad signature", { status: 400 });
  // envelope.type is "order.paid", "attendee.checked_in", …
  return new Response("ok");
}
```

## Regenerating

`pnpm --filter @evnelo/sdk generate` reads `apps/web/lib/openapi.ts`, writes `openapi.json` and `src/schema.d.ts`. Commit both. `pnpm --filter @evnelo/sdk test` checks the client against a mocked fetch and the signature helper.
