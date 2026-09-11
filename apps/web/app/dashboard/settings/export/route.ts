import { NextResponse } from "next/server";
import { exportOrganizationData } from "@ot/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Organization takeout: one JSON file with everything the organization owns (no secrets). Owners/admins only. */
export async function GET() {
  const { org } = await requireOrg("manage_org", "/dashboard/settings");
  const data = await exportOrganizationData(db, org.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="openticket-${org.slug}-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" },
  });
}
