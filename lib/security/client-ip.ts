/**
 * Best-effort client IP for audit logs and rate limits.
 *
 * Assumes exactly ONE trusted reverse proxy in front of the app. Such a proxy appends
 * the address it received to X-Forwarded-For, so the RIGHTMOST entry is the one it saw.
 * Client-supplied leftmost entries are ignored, so rotating the header cannot dodge
 * per-IP limits. Without a proxy, the header is client-controlled and per-IP limits
 * are weak; per-email limits still apply.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
