import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { organizationInvites, organizationMembers, organizations, users, type Database, type Organization } from "@ot/db";
import { newId } from "../ids";
import type { Role } from "../permissions";
import { slugify, slugSuffix } from "../slug";
import { isHttpUrl, normalizeWebsiteUrl } from "../url";

const url = z.string().transform(normalizeWebsiteUrl)
  .pipe(z.string().max(300).refine((value) => !value || isHttpUrl(value), "Must be a valid http:// or https:// URL"))
  .transform((v) => v || null);
export const RESERVED_ORGANIZATION_SLUGS = new Set(["api", "dashboard", "dev", "discover", "e", "invite", "login", "o", "onboarding", "t", "unsubscribe"]);
const organizationSlug = z.string().trim()
  .regex(/^[a-z0-9-]{3,60}$/, "Lowercase letters, numbers and hyphens")
  .refine((slug) => !RESERVED_ORGANIZATION_SLUGS.has(slug), "This URL is reserved.");

export const organizationInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: organizationSlug.optional(),
  website: url.optional(),
  logoUrl: z.string().trim().url().max(500).or(z.literal("")).transform((v) => v || null).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("")).transform((v) => v || null).optional(),
  socialLinks: z.array(z.object({ platform: z.string(), url: z.string().url() })).optional(),
  feePassThrough: z.boolean().optional(),
});
export type OrganizationInput = z.infer<typeof organizationInput>;

async function uniqueOrgSlug(db: Database, base: string) {
  let slug = RESERVED_ORGANIZATION_SLUGS.has(base) ? `${base}-${slugSuffix()}` : base;
  for (let i = 0; i < 5; i++) {
    const [hit] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (!hit) return slug;
    slug = `${base}-${slugSuffix()}`;
  }
  return `${base}-${newId().slice(-6).toLowerCase()}`;
}

/** First-run setup and "new organization": creates the org and makes the caller its owner. */
export async function createOrganization(db: Database, input: OrganizationInput & { ownerUserId: string }) {
  const id = newId();
  const slug = await uniqueOrgSlug(db, input.slug ?? slugify(input.name, 60));
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({ id, slug, name: input.name, website: input.website ?? null, logoUrl: input.logoUrl ?? null });
    await tx.insert(organizationMembers).values({ organizationId: id, userId: input.ownerUserId, role: "owner" });
  });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return org!;
}

export async function updateOrganization(db: Database, orgId: string, input: OrganizationInput) {
  const patch: Partial<typeof organizations.$inferInsert> = { name: input.name };
  if (input.website !== undefined) patch.website = input.website;
  if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;
  if (input.accentColor !== undefined) patch.accentColor = input.accentColor;
  if (input.socialLinks !== undefined) patch.socialLinks = input.socialLinks as Organization["socialLinks"];
  if (input.feePassThrough !== undefined) patch.feePassThrough = input.feePassThrough;
  if (input.slug) {
    const [taken] = await db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.slug, input.slug))).limit(1);
    if (taken && taken.id !== orgId) throw new Error("That URL is already taken.");
    patch.slug = input.slug;
  }
  await db.update(organizations).set(patch).where(eq(organizations.id, orgId));
}

export async function listMemberships(db: Database, userId: string) {
  return db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), isNull(organizations.deletedAt)))
    .orderBy(asc(organizations.name));
}

export async function getMembership(db: Database, userId: string, orgId: string): Promise<Role | null> {
  const [m] = await db.select({ role: organizationMembers.role }).from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId))).limit(1);
  return m?.role ?? null;
}

export async function listMembers(db: Database, orgId: string) {
  return db
    .select({ userId: users.id, email: users.email, name: users.name, role: organizationMembers.role, since: organizationMembers.createdAt })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, orgId))
    .orderBy(asc(organizationMembers.createdAt));
}

export async function listPendingInvites(db: Database, orgId: string) {
  return db.select().from(organizationInvites)
    .where(and(eq(organizationInvites.organizationId, orgId), isNull(organizationInvites.acceptedAt)))
    .orderBy(asc(organizationInvites.createdAt));
}

/** Creates the invite row; the caller sends the email with `/invite/{token}`. */
export async function inviteMember(db: Database, input: { orgId: string; email: string; role: Exclude<Role, "owner"> }) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).innerJoin(organizationMembers, and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, input.orgId))).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("That person is already a member.");
  const token = randomBytes(36).toString("base64url").slice(0, 48);
  const id = newId();
  await db.insert(organizationInvites).values({ id, organizationId: input.orgId, email, role: input.role, token, expiresAt: new Date(Date.now() + 14 * 86_400_000) });
  return { id, token, email, role: input.role };
}

export async function revokeInvite(db: Database, orgId: string, inviteId: string) {
  await db.delete(organizationInvites).where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.organizationId, orgId)));
}

export async function getInvite(db: Database, token: string) {
  const [row] = await db.select({ invite: organizationInvites, org: organizations }).from(organizationInvites)
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .where(eq(organizationInvites.token, token)).limit(1);
  return row ?? null;
}

/** Signed-in user accepts an invite addressed to their email. Returns the org id. */
export async function acceptInvite(db: Database, token: string, user: { id: string; email: string }) {
  const row = await getInvite(db, token);
  if (!row) throw new Error("This invite link is not valid.");
  const { invite } = row;
  if (invite.acceptedAt) throw new Error("This invite was already used.");
  if (invite.expiresAt < new Date()) throw new Error("This invite has expired. Ask for a new one.");
  if (invite.email !== user.email.toLowerCase()) throw new Error(`This invite was sent to ${invite.email}. Sign in with that address.`);
  await db.transaction(async (tx) => {
    await tx.insert(organizationMembers).values({ organizationId: invite.organizationId, userId: user.id, role: invite.role }).onDuplicateKeyUpdate({ set: { role: invite.role } });
    await tx.update(organizationInvites).set({ acceptedAt: new Date() }).where(eq(organizationInvites.id, invite.id));
  });
  return invite.organizationId;
}

export async function setMemberRole(db: Database, orgId: string, userId: string, role: Role) {
  if (role !== "owner") await assertNotLastOwner(db, orgId, userId);
  await db.update(organizationMembers).set({ role }).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)));
}

export async function removeMember(db: Database, orgId: string, userId: string) {
  await assertNotLastOwner(db, orgId, userId);
  await db.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)));
}

async function assertNotLastOwner(db: Database, orgId: string, userId: string) {
  const owners = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, "owner")));
  if (owners.length === 1 && owners[0]!.userId === userId) throw new Error("An organization needs at least one owner.");
}
