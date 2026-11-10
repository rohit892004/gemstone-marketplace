import { unsubscribeByToken } from "@/lib/newsletter/service";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * One-click unsubscribe (RFC 8058). Mail clients POST here with the token in the query string and the
 * form field List-Unsubscribe=One-Click. A valid token always gets the same 200 response, and so does a
 * repeat. An invalid token gets one neutral 404. Only GET is not supported: it has no side effects.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = token.length > 0 && (await unsubscribeByToken(token, { ip: getClientIp(request.headers), source: "one-click" }));
  if (!ok) return Response.json({ ok: false, message: "This link is not valid." }, { status: 404 });
  return Response.json({ ok: true, message: "You have been unsubscribed." }, { status: 200 });
}
