import { z } from "zod";
import { ORDER_STATUSES, listOrdersPage, paginate } from "@ot/core/services";
import { apiRoute, ok, pageQuery, parseQuery, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const listQuery = z.object({ status: z.enum(ORDER_STATUSES).optional(), email: z.string().trim().max(255).optional(), ...pageQuery });

export const GET = apiRoute<{ id: string }>("read", async ({ request, auth, params }) => {
  const { status, email, limit, offset } = parseQuery(request, listQuery);
  await requireOrgEvent(auth, params.id);
  const rows = await listOrdersPage(db, params.id, { status, email, limit: limit + 1, offset });
  return ok(auth, paginate(rows.map((r) => ({ ...r.order, attendeeCount: r.attendeeCount, buyerName: r.buyerName })), limit, offset));
});
