import { logs, SeverityNumber, type Logger } from "@opentelemetry/api-logs";

type Level = "info" | "warn" | "error";
type Attrs = Record<string, string | number | boolean | null | undefined>;
const SEVERITY: Record<Level, SeverityNumber> = { info: SeverityNumber.INFO, warn: SeverityNumber.WARN, error: SeverityNumber.ERROR };

let logger: Logger | undefined;
function otel() {
  return (logger ??= logs.getLogger("evnelo-web"));
}

function write(level: Level, scope: string, message: string, attrs?: Attrs) {
  // one JSON line per record, so container logs stay greppable and structured
  const line = JSON.stringify({ time: new Date().toISOString(), level, scope, message, ...attrs });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
  // the global logger provider is a no-op until instrumentation.ts installs the PostHog exporter
  otel().emit({ severityNumber: SEVERITY[level], severityText: level.toUpperCase(), body: message, attributes: { scope, ...stripUndefined(attrs) } });
}

function stripUndefined(attrs?: Attrs) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) if (v !== undefined && v !== null) out[k] = v;
  return out;
}

/**
 * Structured server logs. `scope` is a stable dotted code path ("jobs.tick", "stripe.webhook"),
 * attributes are ids and counts, never emails. Printed as JSON and, when PostHog is configured,
 * shipped to PostHog Logs where they sit next to the traces and errors of the same request.
 */
export const log = {
  info: (scope: string, message: string, attrs?: Attrs) => write("info", scope, message, attrs),
  warn: (scope: string, message: string, attrs?: Attrs) => write("warn", scope, message, attrs),
  error: (scope: string, message: string, attrs?: Attrs) => write("error", scope, message, attrs),
};
