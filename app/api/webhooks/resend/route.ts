import { prisma } from "@/lib/db/client";
import { suppressAddress } from "@/lib/newsletter/service";
import { parseResendEvent, verifyResendWebhook } from "@/lib/newsletter/webhook";

/**
 * Resend delivery events (Svix-signed). Bounces and complaints suppress the address, so we never mail it
 * again. The raw body is read first, because the signature covers the exact bytes.
 */
export const runtime = "nodejs";

const PROVIDER = "resend";

/** The event types that suppress recipients. Other types are acknowledged and ignored. */
const SUPPRESSING: Record<string, "BOUNCE" | "COMPLAINT"> = {
  "email.bounced": "BOUNCE",
  "email.complained": "COMPLAINT",
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook:resend] RESEND_WEBHOOK_SECRET is not set. Event refused.");
    return new Response("Webhook not configured", { status: 503 });
  }

  const body = await request.text();
  const id = request.headers.get("svix-id");
  const check = verifyResendWebhook({
    body,
    id,
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!check.ok) {
    if (check.reason === "bad_secret") {
      console.error("[webhook:resend] RESEND_WEBHOOK_SECRET has the wrong format (expected whsec_...).");
      return new Response("Webhook not configured", { status: 503 });
    }
    return new Response("Invalid signature", { status: 401 });
  }

  const event = parseResendEvent(body);
  if (!event || !id) return new Response("Malformed event", { status: 400 });

  // Dedupe: the event id is the primary key. A redelivery hits the unique constraint and is acknowledged.
  try {
    await prisma.webhookEvent.create({ data: { id, provider: PROVIDER, type: event.type } });
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ ok: true, duplicate: true });
    throw error;
  }

  const reason = SUPPRESSING[event.type];
  if (reason) {
    try {
      for (const recipient of event.recipients) {
        await suppressAddress({ email: recipient, reason, source: `resend:${event.type}` });
      }
    } catch (error) {
      // Free the id so the provider's retry is processed, then fail the delivery so it is retried.
      await prisma.webhookEvent.delete({ where: { id } }).catch(() => undefined);
      console.error("[webhook:resend] suppression failed", error);
      return new Response("Processing failed", { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
