import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { env } from "./env";

let provider: LoggerProvider | undefined;

/**
 * Ship lib/log.ts records to PostHog Logs over OTLP. Installed once per process from
 * instrumentation.ts; a no-op without POSTHOG_KEY, in which case logs only reach stdout.
 */
export function startLogExport() {
  if (provider || !env.POSTHOG_KEY) return;
  provider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "evnelo-web", "service.version": process.env.APP_VERSION ?? "dev", "deployment.environment": env.POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV }),
    processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${env.POSTHOG_HOST}/i/v1/logs`, headers: { Authorization: `Bearer ${env.POSTHOG_KEY}` } }) })],
  });
  logs.setGlobalLoggerProvider(provider);
}

export async function stopLogExport() {
  await provider?.shutdown().catch(() => undefined);
  provider = undefined;
}
