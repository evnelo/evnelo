import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDb, organizationMembers, organizations } from "@evnelo/db";
import { newId } from "../ids";
import { connectOrganizationStripe, updateStripeAccountStatus } from "../services";

const db = createDb(process.env.DATABASE_URL ?? "mysql://evnelo:evnelo@localhost:3306/evnelo");
const reachable = await db.execute(sql`SELECT 1`).then(() => true, () => false);
const orgId = newId();
const ownerId = newId();
const memberId = newId();

describe.skipIf(!reachable)("Stripe organization binding against MySQL", () => {
  afterAll(async () => {
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("authorizes membership and preserves one payout account under concurrent callbacks", async () => {
    await db.insert(organizations).values({ id: orgId, name: "Connect test", slug: `connect-${orgId.toLowerCase()}` });
    await db.insert(organizationMembers).values([
      { organizationId: orgId, userId: ownerId, role: "owner" },
      { organizationId: orgId, userId: memberId, role: "member" },
    ]);
    expect(await connectOrganizationStripe(db, orgId, memberId, "acct_forbidden", true)).toBe(false);
    expect(await connectOrganizationStripe(db, orgId, newId(), "acct_forbidden", true)).toBe(false);
    const results = await Promise.all([
      connectOrganizationStripe(db, orgId, ownerId, "acct_first", true),
      connectOrganizationStripe(db, orgId, ownerId, "acct_second", false),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const [bound] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(bound?.stripeAccountType).toBe("standard");
    expect(await connectOrganizationStripe(db, orgId, ownerId, bound!.stripeAccountId!, true)).toBe(true);
    await updateStripeAccountStatus(db, bound!.stripeAccountId!, false);
    const [disabled] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(disabled?.stripeChargesEnabled).toBe(false);
    expect(disabled?.stripeAccountId).toBe(bound?.stripeAccountId);
    await db.update(organizationMembers).set({ role: "member" }).where(eq(organizationMembers.userId, ownerId));
    expect(await connectOrganizationStripe(db, orgId, ownerId, bound!.stripeAccountId!, true)).toBe(false);
    await db.update(organizationMembers).set({ role: "owner" }).where(eq(organizationMembers.userId, ownerId));
    await db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, orgId));
    expect(await connectOrganizationStripe(db, orgId, ownerId, bound!.stripeAccountId!, true)).toBe(false);
  });
});
