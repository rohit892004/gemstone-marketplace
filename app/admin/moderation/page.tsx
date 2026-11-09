import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
import { contactKindLabel, flagSourceLabel } from "@/lib/admin-moderation/labels";
import { isRestricted, RESTRICTION_DAYS } from "@/lib/admin-moderation/restriction";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { resolveFlag } from "./actions";

export const metadata = { title: "Flagged messages", robots: { index: false, follow: false } };

export default function AdminModerationPage() {
  return (
    <Suspense fallback={null}>
      <FlagQueue />
    </Suspense>
  );
}

/**
 * Open contact-detail flags, oldest first. Shows the MASKED text as stored and the kinds that were
 * detected. The detected values themselves are never stored, so they cannot appear here.
 */
async function FlagQueue() {
  await requirePageRole(["ADMIN"]);
  const now = new Date();

  const flags = await prisma.moderationFlag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      conversationId: true,
      messageId: true,
      requirementId: true,
      source: true,
      kinds: true,
      createdAt: true,
      sender: {
        select: {
          name: true,
          email: true,
          role: true,
          contactStrikes: true,
          messagingRestrictedUntil: true,
        },
      },
      conversation: { select: { isDemo: true } },
      message: { select: { body: true, createdAt: true } },
    },
  });

  // ModerationFlag.requirementId has no relation, so requirement notes are loaded separately.
  const requirementIds = flags.map((flag) => flag.requirementId).filter((id): id is string => id !== null);
  const requirements =
    requirementIds.length > 0
      ? await prisma.requirement.findMany({
          where: { id: { in: requirementIds } },
          select: { id: true, notes: true },
        })
      : [];
  const notesById = new Map(requirements.map((requirement) => [requirement.id, requirement.notes]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Flagged messages</h1>
        <p className="text-sm text-stone-600">
          Messages where contact details were masked before they were stored. Only the masked text is shown.
          {flags.length > 0 ? ` ${flags.length} open.` : ""}
        </p>
      </header>

      {flags.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          No open flags. Nothing to review.
        </p>
      ) : (
        <ul className="space-y-4">
          {flags.map((flag) => {
            const text = flag.messageId ? flag.message?.body : notesById.get(flag.requirementId ?? "");
            const restricted = isRestricted(flag.sender.messagingRestrictedUntil, now);
            return (
              <li key={flag.id} className="space-y-4 rounded border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{flagSourceLabel(flag.source)}</span>
                  <span className="text-stone-600">Sent {formatDate(flag.message?.createdAt ?? flag.createdAt)}</span>
                  {flag.conversation?.isDemo ? <DemoBadge /> : null}
                </div>

                <dl className="grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-600">Sender</dt>
                    <dd>
                      {flag.sender.name ?? "Unnamed user"} ({flag.sender.role.toLowerCase()})
                    </dd>
                    <dd className="break-all text-stone-600">{flag.sender.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-600">Detected</dt>
                    <dd>
                      {flag.kinds.length > 0 ? flag.kinds.map((kind) => contactKindLabel(kind)).join(", ") : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-600">Account</dt>
                    <dd>
                      Contact strikes: {flag.sender.contactStrikes}
                      {restricted ? ` · Restricted until ${formatDate(flag.sender.messagingRestrictedUntil)}` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-stone-600">Masked text</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-stone-100 p-3 text-sm">
                    {text ?? "(no text stored)"}
                  </p>
                  {/* prefetch={false}: each render of the viewer writes an audit row, so nothing may load it early. */}
                  {flag.conversationId ? (
                    <Link
                      href={`/admin/conversations/${flag.conversationId}`}
                      prefetch={false}
                      className="inline-block text-sm underline"
                    >
                      Open the conversation (logged with a reason)
                    </Link>
                  ) : (
                    <p className="text-sm text-stone-600">Requirement note: no conversation to open.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ActionForm
                    action={resolveFlag}
                    title="Dismiss"
                    description="No action. The message stays as it is."
                    submitLabel="Dismiss flag"
                    hidden={{ flagId: flag.id, decision: "DISMISS" }}
                  />
                  <ActionForm
                    action={resolveFlag}
                    title="Mark actioned"
                    description="The flag is closed as handled. Optionally restrict the sender's messaging."
                    submitLabel="Mark actioned"
                    tone="danger"
                    hidden={{ flagId: flag.id, decision: "ACTION" }}
                    fields={[
                      {
                        name: "restrict",
                        label: `Restrict messaging for ${RESTRICTION_DAYS} days`,
                        kind: "checkbox",
                        help: "The sender cannot send messages until the restriction ends.",
                      },
                      {
                        name: "note",
                        label: "Note (optional)",
                        kind: "textarea",
                        maxLength: 500,
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
