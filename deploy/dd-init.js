// Datadog APM bootstrap, preloaded by deploy/entrypoint.sh when DD_AGENT_HOST is set. Service, env and
// version come from DD_SERVICE, DD_ENV and DD_VERSION.
//
// One span per incoming request (the Next.js plugin, which names resources by route pattern) plus the
// MySQL queries under it. The generic HTTP server plugin would add a second span per request; the
// client-side HTTP, fetch, DNS and socket plugins would turn every call to PostHog, Stripe and Resend
// into resources of their own. Traffic that is not the app (the PostHog relay proxy, static assets,
// icons, the health check) is dropped before it leaves the process.
const tracer = require("/app/dd/node_modules/dd-trace");
tracer.init();

const NOISE = [/^\/relay\//, /^\/_next\//, /^\/api\/health$/, /^\/\.well-known\//, /^\/(favicon|icon|apple-icon|opengraph-image|robots|sitemap|manifest)/];

tracer.use("http", false);
tracer.use("fetch", false);
tracer.use("undici", false);
tracer.use("dns", false);
tracer.use("net", false);
tracer.use("next", {
  hooks: {
    request(span, req) {
      const path = String(req?.url ?? "").split("?")[0];
      if (NOISE.some((pattern) => pattern.test(path))) span.setTag("manual.drop", true);
    },
  },
});
