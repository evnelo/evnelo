import { getEventWithRelations, listRegistrationFields } from "@ot/core/services";
import { apiError, requireApiKey, type ApiRequestContext } from "@/lib/api";
import { apiJson } from "@/lib/api-http";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth: ApiRequestContext | undefined;
  try {
    const [context, { id }] = await Promise.all([requireApiKey(request, "read"), params]);
    auth = context;
    const result = await getEventWithRelations(db, id);
    if (!result || result.event.organizationId !== auth.organizationId) {
      return apiJson({ error: { code: "not_found", message: "Event not found." } }, { status: 404 }, auth.rateLimit);
    }
    return apiJson({ data: { ...result, registrationFields: await listRegistrationFields(db, id) } }, {}, auth.rateLimit);
  } catch (error) {
    return apiError(error, auth);
  }
}