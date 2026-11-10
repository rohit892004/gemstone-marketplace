import { getEnv } from "@/lib/config/env";

/**
 * Best-effort client IP for audit logs and rate limits.
 *
 * X-Forwarded-For is a list. Each trusted proxy APPENDS the address it received, so the entry
 * appended by the proxy nearest to the app is N entries from the RIGHT, where N is
 * TRUSTED_PROXY_COUNT (default 1: one Nginx in front of the app). Entries further left were
 * supplied by the client or by an earlier hop and are not trusted, so a client that prepends
 * fake addresses cannot rotate its per-IP limits.
 *
 * - N = 0 (no proxy): X-Forwarded-For is client-controlled and ignored. X-Real-IP is used if present.
 * - Header with fewer than N entries: "unknown" (the request did not pass through the expected proxies).
 * - Header absent: X-Real-IP, then "unknown".
 *
 * Set TRUSTED_PROXY_COUNT to the real number of proxies. Too high a value reads a client-supplied
 * entry; too low a value reads a proxy address and merges every user into one bucket.
 */
export function getClientIp(headers: Headers, trustedProxyCount?: number): string {
  const count = trustedProxyCount ?? getEnv().TRUSTED_PROXY_COUNT;
  const forwarded = headers.get("x-forwarded-for");

  if (count > 0 && forwarded !== null) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < count) return "unknown";
    return parts[parts.length - count];
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
