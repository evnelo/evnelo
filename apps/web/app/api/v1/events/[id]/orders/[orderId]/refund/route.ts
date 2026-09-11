import { apiRoute, conflict, mutate, notFound, requireOrgEvent } from "@/lib/api";
import { requestFullRefund } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * Full refund through Stripe, the same path as the dashboard. Accepted (202): the order moves to
 * `refunded` when Stripe confirms through the charge.refunded webhook. 409 when there is nothing to refund.
 */
export const POST = apiRoute<{ id: string; orderId: string }>("write", async ({ request, auth, params }) => {
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, null, async () => {
    const result = await requestFullRefund(params.id, params.orderId);
    if (!result.ok) throw result.reason === "not_found" ? notFound("Order") : conflict(result.message);
    return { status: 202, body: { data: { orderId: result.order.id, status: result.order.status, refund: "requested" } } };
  });
});
