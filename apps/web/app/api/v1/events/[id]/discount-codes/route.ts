import { z } from "zod";
import { createDiscountCode, discountCodeInput, listDiscountCodes, paginateAll } from "@evnelo/core/services";
import { apiRoute, businessRule, mutate, ok, pageQuery, parseBody, parseQuery, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  await requireOrgEvent(auth, params.id);
  return ok(auth, paginateAll(await listDiscountCodes(db, params.id), limit, offset));
});

/** Codes are upper-cased; a code that already exists for the event is a 409. */
export const POST = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const input = await parseBody(request, discountCodeInput, "Invalid discount code.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, input, async (database) => ({ status: 201, body: { data: await businessRule(409, () => createDiscountCode(database, params.id, input)) } }));
});
