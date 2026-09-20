import { DEMO } from "./helpers";

/**
 * Global setup: confirm the server answers and touch every route the suite visits. Against the
 * production image this is a readiness check; against `next dev` it also triggers the on-demand
 * compilation, which otherwise lands inside the first test's budget.
 */
export default async function warmUp() {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const health = await fetch(`${base}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`no healthy server at ${base} (start it, seed the database, or set BASE_URL)`);
  const paths = [
    "/", "/discover", "/login", "/onboarding", "/dashboard", "/dashboard/events/new",
    `/${DEMO.org}/${DEMO.freeEvent.slug}`, `/${DEMO.org}/${DEMO.paidEvent.slug}`,
    "/api/orders", "/api/auth/callback/resend", "/orders/warm-up", "/legal/terms",
  ];
  await Promise.all(paths.map((p) => fetch(`${base}${p}`, { redirect: "manual" }).catch(() => null)));
}
