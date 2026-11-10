import { consentTextFor } from "@/lib/newsletter/messages";
import { requestSubscription } from "@/lib/newsletter/service";
import { parseConsentScope } from "@/lib/newsletter/topics";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Newsletter sign-up. Accepts JSON or a form post. The response is the same for every address that is
 * well-formed and has a topic: nothing says whether the address already subscribes or is suppressed.
 */
const ACCEPTED_MESSAGE =
  "Thank you. If this address can receive our newsletter, we have sent a confirmation link. Check your inbox and spam folder.";

interface SubscribeBody {
  email: unknown;
  topics: unknown;
  source: unknown;
  scope: unknown;
}

async function readBody(request: Request): Promise<SubscribeBody> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const parsed = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return { email: parsed?.email, topics: parsed?.topics, source: parsed?.source, scope: parsed?.scope };
  }
  const form = await request.formData().catch(() => null);
  return {
    email: form?.get("email"),
    topics: form?.getAll("topics") ?? [],
    source: form?.get("source"),
    scope: form?.get("scope"),
  };
}

function cleanSource(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9_-]{1,40}$/.test(value) ? value : "unknown";
}

function toTopicList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  // The scope decides what was agreed to, and therefore which consent text is stored (the text shown beside it).
  const scope = parseConsentScope(body.scope);
  const result = await requestSubscription({
    email: typeof body.email === "string" ? body.email : "",
    topics: toTopicList(body.topics),
    source: cleanSource(body.source),
    scope,
    consentText: consentTextFor(scope),
    ip: getClientIp(request.headers),
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return Response.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    return Response.json({ ok: false, error: result.reason }, { status: 422 });
  }
  return Response.json({ ok: true, message: ACCEPTED_MESSAGE }, { status: 202 });
}
