import { requestSubscription } from "@/lib/newsletter/service";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Newsletter sign-up. Accepts JSON or a form post. The response is the same for every address that is
 * well-formed and has a topic: nothing says whether the address already subscribes or is suppressed.
 */
export const runtime = "nodejs";

const ACCEPTED_MESSAGE =
  "Thank you. If this address can receive our newsletter, we have sent a confirmation link. Check your inbox and spam folder.";

interface SubscribeBody {
  email: unknown;
  topics: unknown;
  source: unknown;
}

async function readBody(request: Request): Promise<SubscribeBody> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const parsed = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return { email: parsed?.email, topics: parsed?.topics, source: parsed?.source };
  }
  const form = await request.formData().catch(() => null);
  return {
    email: form?.get("email"),
    topics: form?.getAll("topics") ?? [],
    source: form?.get("source"),
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
  const result = await requestSubscription({
    email: typeof body.email === "string" ? body.email : "",
    topics: toTopicList(body.topics),
    source: cleanSource(body.source),
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
