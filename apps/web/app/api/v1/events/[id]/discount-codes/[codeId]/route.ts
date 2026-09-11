import { deleteDiscountCode } from "@evnelo/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const DELETE = apiRoute<{ id: string; codeId: string }>("write", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  if (!(await deleteDiscountCode(db, params.id, params.codeId))) throw notFound("Discount code");
  return ok(auth, { data: { id: params.codeId, deleted: true } });
});
