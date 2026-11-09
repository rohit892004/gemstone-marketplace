/**
 * Best-effort client IP for audit logs and rate limits.
 *
 * Trusts X-Forwarded-For / X-Real-IP. Only correct behind a reverse proxy that
 * overwrites these headers. Deploy behind one, or the IP can be spoofed and
 * per-IP rate limits become weaker (per-email limits still apply).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
