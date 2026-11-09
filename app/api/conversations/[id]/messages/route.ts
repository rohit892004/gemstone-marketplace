import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/require-role";
import { MESSAGING_ROLES } from "@/lib/messaging/access";
import { listMessagesSince } from "@/lib/messaging/service";

/**
 * Polling transport for chat threads. GET /api/conversations/:id/messages?since=ISO
 * Returns messages newer than `since`, plus read markers for receipts.
 * Non-participants get 404, the same as a missing conversation.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireApiRole(MESSAGING_ROLES, { sellerApproved: true });
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const sinceParam = new URL(req.url).searchParams.get("since");
  let since: Date | null = null;
  if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "INVALID_SINCE" }, { status: 400 });
    }
    since = parsed;
  }

  const result = await listMessagesSince(id, guard.user.id, since);
  if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json(
    {
      messages: result.messages.map((m) => ({
        id: m.id,
        kind: m.kind,
        body: m.body,
        flagged: m.flagged,
        createdAt: m.createdAt.toISOString(),
        mine: m.senderId === guard.user.id,
        attachments: m.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      })),
      myLastReadAt: result.myLastReadAt?.toISOString() ?? null,
      counterpartLastReadAt: result.counterpartLastReadAt?.toISOString() ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
