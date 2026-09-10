import { eventHosts, eventSponsors, events, organizations } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cleanupOrganizationUploads, uploadDirectory, uploadedImageOwner } from "@/lib/uploads";
import { readdir } from "node:fs/promises";

const ORPHAN_AGE_MS = 7 * 24 * 60 * 60_000;

function filenameOf(url: string | null) {
  if (!url) return null;
  try { return new URL(url).pathname.split("/").pop() || null; } catch { return null; }
}

/**
 * Delete uploaded images that no event, organization, host or sponsor references and that are
 * older than a week (long enough for an unsaved editor to come back). Runs from the job loop.
 */
export async function sweepOrphanUploads() {
  const directory = uploadDirectory(env.UPLOAD_DIR);
  let owners: Set<string>;
  try {
    owners = new Set((await readdir(directory)).map(uploadedImageOwner).filter((o): o is string => !!o));
  } catch {
    return 0; // no upload directory yet
  }
  if (!owners.size) return 0;
  const referenced = new Set<string>();
  const [ev, orgs, hosts, sponsors] = await Promise.all([
    db.select({ a: events.coverImageUrl, b: events.logoUrl }).from(events),
    db.select({ a: organizations.logoUrl }).from(organizations),
    db.select({ a: eventHosts.avatarUrl }).from(eventHosts),
    db.select({ a: eventSponsors.logoUrl }).from(eventSponsors),
  ]);
  for (const row of [...ev, ...orgs, ...hosts, ...sponsors]) {
    for (const url of Object.values(row)) { const f = filenameOf(url as string | null); if (f) referenced.add(f); }
  }
  const olderThan = new Date(Date.now() - ORPHAN_AGE_MS);
  for (const owner of owners) await cleanupOrganizationUploads(directory, owner, referenced, olderThan);
  return owners.size;
}
