import { getEnv } from "@/lib/config/env";

/**
 * Error monitoring hook. Does nothing unless SENTRY_DSN is set. When it is, the error is sent to Sentry as a
 * single event envelope over plain HTTP (no SDK). Never throws, and never delays a response for long.
 *
 * Scrubbing: request bodies, cookies, authorisation headers and any key that looks like a secret or personal
 * field are removed before sending. Email addresses and phone numbers in messages are masked.
 */

const SENSITIVE_KEY = /cookie|authorization|set-cookie|password|secret|token|session|body|email|phone|mobile|otp|csrf/i;
const MAX_STRING = 500;
const SEND_TIMEOUT_MS = 2_000;

/** Removes sensitive keys (recursively), truncates long strings and masks emails and phone numbers. Pure. */
export function scrubForReport(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return maskPersonal(value).slice(0, MAX_STRING);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubForReport(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[scrubbed]" : scrubForReport(item, depth + 1);
  }
  return out;
}

export function maskPersonal(text: string): string {
  return text
    .replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g, "[email]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]");
}

export interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
  url: string;
}

/** Parses https://<publicKey>@<host>/<projectId>. Returns undefined for anything else. */
export function parseDsn(dsn: string): ParsedDsn | undefined {
  const match = /^https:\/\/([^@/]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  if (!match) return undefined;
  const [, publicKey, host, projectId] = match;
  return { publicKey, host, projectId, url: `https://${host}/api/${projectId}/envelope/` };
}

/** Builds the Sentry envelope (newline-delimited JSON). Exported for tests. */
export function buildEnvelope(
  parsed: ParsedDsn,
  error: unknown,
  context: Record<string, unknown>,
  now = new Date(),
): { body: string; eventId: string } {
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const err = error instanceof Error ? error : undefined;
  const message = maskPersonal(err ? err.message : String(error)).slice(0, MAX_STRING);
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "node",
    level: "error",
    logger: "gemstone-app",
    exception: { values: [{ type: err?.name ?? "Error", value: message }] },
    extra: scrubForReport(context) as Record<string, unknown>,
  };
  const envelopeHeader = {
    event_id: eventId,
    sent_at: now.toISOString(),
    dsn: `https://${parsed.publicKey}@${parsed.host}/${parsed.projectId}`,
  };
  const itemHeader = { type: "event" };
  return {
    body: [JSON.stringify(envelopeHeader), JSON.stringify(itemHeader), JSON.stringify(event)].join("\n"),
    eventId,
  };
}

/**
 * Reports an error with optional context. Safe to call anywhere on the server. Off unless SENTRY_DSN is set.
 * Failures to report are swallowed, so monitoring can never break a request.
 */
export async function reportError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  let dsn: string | undefined;
  try {
    dsn = getEnv().SENTRY_DSN;
  } catch {
    return; // invalid environment: the startup check already reports it
  }
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  try {
    const { body } = buildEnvelope(parsed, error, context);
    await fetch(parsed.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=gemstone-minimal/1.0`,
      },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    // Ignored on purpose. Nothing about the failure is logged, to avoid echoing sensitive data.
  }
}
