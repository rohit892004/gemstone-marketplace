import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";

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
      gemstone: { select: { id: true, title: true } },
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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Queue"
        title="Flagged messages"
        lead={
          <>
            Messages where contact details were masked before they were stored. Only the masked text is shown.
            {flags.length > 0 ? ` ${flags.length} open.` : ""}
          </>
        }
      />

      {flags.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No open flags" body="Nothing to review. Flags appear here when contact details are masked in a message." />
      ) : (
        <ul className="space-y-6">
          {flags.map((flag) => {
            const text = flag.messageId ? flag.message?.body : notesById.get(flag.requirementId ?? "");
            const restricted = isRestricted(flag.sender.messagingRestrictedUntil, now);
            return (
              <li key={flag.id}>
                <Card className="space-y-6 p-5 text-sm sm:p-8">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-heading text-xl text-ink">{flagSourceLabel(flag.source)}</span>
                    <span className="text-ink-soft">Sent {formatDate(flag.message?.createdAt ?? flag.createdAt)}</span>
                    {flag.conversation?.isDemo ? <AdminDemoTag /> : null}
                  </div>

                  <dl className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-1">
                      <dt className={LABEL}>Sender</dt>
                      <dd className="text-[15px] text-ink">
                        {flag.sender.name ?? "Unnamed user"} ({flag.sender.role.toLowerCase()})
                      </dd>
                      <dd className="break-all text-ink-soft">{flag.sender.email}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Detected</dt>
                      <dd className="text-[15px] text-ink">{flag.kinds.length > 0 ? flag.kinds.map((kind) => contactKindLabel(kind)).join(", ") : "-"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Account</dt>
                      <dd className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                        Contact strikes: {flag.sender.contactStrikes}
                        {restricted ? <Badge tone="danger">Restricted until {formatDate(flag.sender.messagingRestrictedUntil)}</Badge> : null}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-3">
                    <p className={LABEL}>Masked text</p>
                    <p className="whitespace-pre-wrap break-words border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink">
                      {text ?? "(no text stored)"}
                    </p>
                    {/* prefetch={false}: each render of the viewer writes an audit row, so nothing may load it early. */}
                    {flag.gemstone && (
                      <p className="text-sm text-ink-soft">
                        Listing:{" "}
                        <Link href={`/admin/listings/${flag.gemstone.id}`} prefetch={false} className="text-ink underline underline-offset-4">
                          {flag.gemstone.title}
                        </Link>
                      </p>
                    )}
                    {flag.conversationId ? (
                      <Link
                        href={`/admin/conversations/${flag.conversationId}`}
                        prefetch={false}
                        className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 hover:text-accent-text"
                      >
                        Open the conversation (logged with a reason)
                      </Link>
                    ) : (
                      <p className="text-sm text-ink-soft">
                        {flag.source.startsWith("PUBLIC_")
                          ? "Refused save of public seller text. Nothing was stored, so there is no conversation to open."
                          : "Requirement note: no conversation to open."}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
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
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
