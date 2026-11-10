import { cookies, headers } from "next/headers";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { decodeViewReason, viewCookieName } from "@/lib/admin-moderation/conversation-view";
import {
  CONVERSATION_KIND_LABELS,
  MESSAGE_KIND_LABELS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
} from "@/lib/admin-moderation/labels";
import { idSchema } from "@/lib/admin-moderation/schemas";
import { requirePageRole } from "@/lib/auth/require-role";
import { viewConversationAsAdmin, type AdminConversationView } from "@/lib/messaging/access";
import { getClientIp } from "@/lib/security/client-ip";
import { beginConversationView, endConversationView } from "./actions";

/**
 * Audited conversation viewer. Reading a private conversation is the only admin path to its
 * messages, and it always goes through viewConversationAsAdmin(), which needs a reason and writes
 * the audit row first. The reason comes from a 30-minute cookie set by beginConversationView().
 *
 * Every load of this page is one view: it calls viewConversationAsAdmin() again and writes another
 * audit row. A refresh therefore adds a row; it never shows the conversation without one. When the
 * cookie is missing or invalid, or the audit write fails, no messages are rendered at all.
 */

export const metadata = { title: "Conversation (audited)", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default function AdminConversationPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <Viewer params={params} />
    </Suspense>
  );
}

async function Viewer({ params }: { params: Params }) {
  const admin = await requirePageRole(["ADMIN"]);
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const store = await cookies();
  const reason = decodeViewReason(store.get(viewCookieName(id))?.value);
  if (!reason) return <ReasonGate conversationId={id} />;

  const result = await viewConversationAsAdmin(id, reason, getClientIp(await headers()));
  if ("error" in result) {
    if (result.error === "NOT_FOUND") notFound();
    const message =
      result.error === "AUDIT_FAILED"
        ? "The view could not be recorded, so the conversation is not shown. Enter the reason again to retry."
        : "Your reason is no longer valid. Enter it again.";
    return <ReasonGate conversationId={id} message={message} />;
  }

  return <Transcript conversationId={id} view={result} adminEmail={admin.email} />;
}

function ReasonGate({ conversationId, message }: { conversationId: string; message?: string }) {
  return (
    <div className="space-y-10">
      <BackLink />
      <PageHeader
        eyebrow="Audited view"
        title="Conversation"
        lead="Reading a private conversation needs a reason. The reason and your account are logged. Each time the conversation loads, including refreshes, another audit entry is written. The view stays open for 30 minutes after you enter a reason."
      />
      {message ? (
        <p role="alert" className="border-l-2 border-danger bg-surface-raised px-5 py-4 text-sm leading-relaxed text-danger">
          {message}
        </p>
      ) : null}
      <div className="max-w-2xl">
        <ActionForm
          action={beginConversationView}
          title="Reason for viewing"
          description="For example: responding to report R-123 about a price dispute."
          submitLabel="Open conversation"
          hidden={{ conversationId }}
          fields={[
            {
              name: "reason",
              label: "Reason (10 to 500 characters)",
              kind: "textarea",
              required: true,
              maxLength: 500,
            },
          ]}
        />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <div className="flex flex-wrap gap-6 text-sm">
      <Link href="/admin/moderation" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent-text">
        Flagged messages
      </Link>
      <Link href="/admin/reports" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent-text">
        Reports
      </Link>
    </div>
  );
}

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";

function Transcript({
  conversationId,
  view,
  adminEmail,
}: {
  conversationId: string;
  view: AdminConversationView;
  adminEmail: string;
}) {
  const { conversation, reason } = view;
  const names = new Map(conversation.participants.map((p) => [p.userId, p.user.name ?? p.user.sellerProfile?.businessName ?? "Unnamed user"]));
  const roleOf = new Map(conversation.participants.map((p) => [p.userId, p.user.role]));
  const showingLimit = conversation.messages.length >= 200;

  return (
    <div className="space-y-12">
      <BackLink />

      <PageHeader
        eyebrow={CONVERSATION_KIND_LABELS[conversation.kind]}
        title="Conversation"
        lead={conversation.isDemo ? <AdminDemoTag /> : undefined}
      />

      <section aria-label="Audit" className="space-y-4 border-l-2 border-accent bg-surface-raised p-5 text-sm sm:p-6">
        <p className="flex flex-wrap items-center gap-3 leading-relaxed text-ink">
          <ShieldAlert className="h-4 w-4 text-accent" strokeWidth={1.25} aria-hidden />
          Viewing as <span className="font-medium">{adminEmail}</span>. This view is logged with the reason below. Refreshing the page logs another view.
        </p>
        <p className="whitespace-pre-wrap break-words text-ink">
          <span className="font-medium">Reason:</span> {reason}
        </p>
        <form action={endConversationView}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <Button type="submit" variant="secondary">
            End view
          </Button>
        </form>
      </section>

      <section className="space-y-6">
        <SectionHeading title="Context" />
        <Card className="p-5 sm:p-8">
          <dl className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <dt className={LABEL}>Listing</dt>
              <dd className="text-[15px] text-ink">{conversation.gemstone?.title ?? "-"}</dd>
            </div>
            <div className="space-y-1">
              <dt className={LABEL}>Requirement</dt>
              <dd className="text-[15px] text-ink">{conversation.requirement?.gemstoneType ?? "-"}</dd>
            </div>
            <div className="space-y-1">
              <dt className={LABEL}>Started</dt>
              <dd className="text-[15px] text-ink">{formatDate(conversation.createdAt)}</dd>
            </div>
            <div className="space-y-2 md:col-span-3">
              <dt className={LABEL}>Participants</dt>
              <dd className="space-y-1 text-[15px] text-ink">
                {conversation.participants.map((p) => (
                  <p key={p.userId}>
                    {p.user.name ?? "Unnamed user"} ({p.user.role.toLowerCase()})
                    {p.user.sellerProfile ? `, ${p.user.sellerProfile.businessName}` : null}
                  </p>
                ))}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      {conversation.reports.length > 0 ? (
        <section className="space-y-6">
          <SectionHeading title="Reports about this conversation" />
          <ul className="space-y-3 text-sm">
            {conversation.reports.map((report) => (
              <li key={report.id} className="border border-line bg-surface-raised p-4">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {REPORT_REASON_LABELS[report.reason]}
                  <Badge tone={report.status === "OPEN" ? "warning" : "neutral"}>{REPORT_STATUS_LABELS[report.status]}</Badge>
                  <span className="font-normal text-ink-soft">{formatDate(report.createdAt)}</span>
                </p>
                {report.details ? <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-ink-soft">{report.details}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-6">
        <SectionHeading title="Messages" />
        <p className="text-[12px] text-ink-soft">Text is shown as stored, with contact details already masked. Attachments are listed by name only.</p>
        {conversation.messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet" body="Messages appear here as they are sent." />
        ) : (
          <ol className="space-y-4">
            {conversation.messages.map((message) => (
              <li key={message.id} className="border border-line bg-surface-raised p-5 text-sm">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-soft">
                  <span className="font-medium text-ink">
                    {names.get(message.senderId) ?? "Unknown user"}
                    {roleOf.get(message.senderId) ? ` (${roleOf.get(message.senderId)?.toLowerCase()})` : ""}
                  </span>
                  <span>{MESSAGE_KIND_LABELS[message.kind]}</span>
                  <span>{formatDate(message.createdAt)}</span>
                  {message.flagged ? <Badge tone="warning">Contact details masked</Badge> : null}
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{message.body}</p>
                {message.attachments.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-[12px] text-ink-soft">
                    {message.attachments.map((file) => (
                      <li key={file.id} className="break-all">
                        Attachment: {file.fileName} ({Math.ceil(file.sizeBytes / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {showingLimit ? <p className="text-[12px] text-ink-soft">Showing the first 200 messages.</p> : null}
      </section>
    </div>
  );
}
