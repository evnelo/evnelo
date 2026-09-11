// Test-time environment: lib/env.ts validates process.env at import, so give it the minimum it
// needs. Real values from the repo-root .env (if present) take precedence for integration-style tests.
try { process.loadEnvFile(new URL("../../.env", import.meta.url).pathname); } catch { /* no root .env */ }
process.env.DATABASE_URL ??= "mysql://evnelo:evnelo@localhost:3306/evnelo";
process.env.AUTH_SECRET ??= "test-secret-with-at-least-32-characters";
process.env.APP_URL ??= "http://localhost:3000";
