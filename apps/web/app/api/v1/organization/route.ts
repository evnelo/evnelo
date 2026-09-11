import { z } from "zod";
import { getOrganization, organizationInput, updateOrganization } from "@evnelo/core/services";
import { apiRoute, businessRule, mutate, notFound, ok, parseBody, parseWith } from "@/lib/api";
import { serializeOrganization } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiRoute("read", async ({ auth }) => {
  const org = await getOrganization(db, auth.organizationId);
  if (!org) throw notFound("Organization");
  return ok(auth, { data: serializeOrganization(org) });
});

/** Partial update: absent keys keep their value; an empty string clears website, logoUrl or accentColor. */
export const PATCH = apiRoute("write", async ({ request, auth }) => {
  const patch = await parseBody(request, z.record(z.unknown()));
  const org = await getOrganization(db, auth.organizationId);
  if (!org) throw notFound("Organization");
  const current = {
    name: org.name, slug: org.slug, website: org.website ?? undefined, logoUrl: org.logoUrl ?? undefined,
    accentColor: org.accentColor ?? undefined, socialLinks: org.socialLinks, feePassThrough: org.feePassThrough,
  };
  const input = parseWith(organizationInput, { ...current, ...patch }, "Invalid organization.");
  return mutate(request, auth, patch, async (database) => {
    await businessRule(409, () => updateOrganization(database, auth.organizationId, input));
    return { body: { data: serializeOrganization((await getOrganization(database, auth.organizationId))!) } };
  });
});
