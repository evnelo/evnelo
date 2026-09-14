// Datadog APM bootstrap, preloaded by deploy/entrypoint.sh when DD_AGENT_HOST is set. Service, env and
// version come from DD_SERVICE, DD_ENV and DD_VERSION. Incoming requests (Next.js routes) and MySQL
// queries are traced; the outbound HTTP, fetch, DNS and socket instrumentation is off so calls to
// PostHog, Stripe and Resend do not show up as resources of their own.
const tracer = require("/app/dd/node_modules/dd-trace");
tracer.init();
tracer.use("http", { client: false });
tracer.use("fetch", false);
tracer.use("undici", false);
tracer.use("dns", false);
tracer.use("net", false);
