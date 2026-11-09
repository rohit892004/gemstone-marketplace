import { cookies, headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
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
    <div className="space-y-6">
      <BackLink />
      <h1 className="text-2xl font-semibold">Conversation</h1>
      <p className="max-w-2xl text-sm text-stone-700">
        Reading a private conversation needs a reason. The reason and your account are logged. Each time the
        conversation loads, including refreshes, another audit entry is written. The view stays open for 30
        minutes after you enter a reason.
      </p>
      {message ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
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
    <div className="flex flex-wrap gap-4 text-sm">
      <Link href="/admin/moderation" className="underline">
        Flagged messages
      </Link>
      <Link href="/admin/reports" className="underline">
        Reports
      </Link>
    </div>
  );
}

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
    <div className="space-y-8">
      <BackLink />

      <header className="space-y-2">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          Conversation {conversation.isDemo ? <DemoBadge /> : null}
        </h1>
        <p className="text-sm text-stone-600">{CONVERSATION_KIND_LABELS[conversation.kind]}</p>
      </header>

      <section aria-label="Audit" className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
        <p>
          Viewing as <span className="font-medium">{adminEmail}</span>. This view is logged with the reason below.
          Refreshing the page logs another view.
        </p>
        <p className="whitespace-pre-wrap break-words">
          <span className="font-medium">Reason:</span> {reason}
        </p>
        <form action={endConversationView}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button type="submit" className="rounded border border-stone-400 bg-white px-3 py-1 hover:bg-stone-100">
            End view
          </button>
        </form>
      </section>

      <section aria-labelledby="context-heading" className="space-y-3">
        <h2 id="context-heading" className="text-lg font-semibold">
          Context
        </h2>
        <dl className="grid gap-4 rounded border border-stone-300 bg-white p-4 md:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-600">Listing</dt>
            <dd className="text-sm">{conversation.gemstone?.title ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-600">Requirement</dt>
            <dd className="text-sm">{conversation.requirement?.gemstoneType ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-600">Started</dt>
            <dd className="text-sm">{formatDate(conversation.createdAt)}</dd>
          </div>
          <div className="md:col-span-3">
            <dt className="text-xs uppercase tracking-wide text-stone-600">Participants</dt>
            <dd className="mt-1 space-y-1 text-sm">
              {conversation.participants.map((p) => (
                <p key={p.userId}>
                  {p.user.name ?? "Unnamed user"} ({p.user.role.toLowerCase()})
                  {p.user.sellerProfile ? `, ${p.user.sellerProfile.businessName}` : null}
                </p>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      {conversation.reports.length > 0 ? (
        <section aria-labelledby="reports-heading" className="space-y-3">
          <h2 id="reports-heading" className="text-lg font-semibold">
            Reports about this conversation
          </h2>
          <ul className="space-y-2 text-sm">
            {conversation.reports.map((report) => (
              <li key={report.id} className="rounded border border-stone-300 bg-white p-3">
                <p className="font-medium">
                  {REPORT_REASON_LABELS[report.reason]} · {REPORT_STATUS_LABELS[report.status]} ·{" "}
                  {formatDate(report.createdAt)}
                </p>
                {report.details ? <p className="mt-1 whitespace-pre-wrap break-words text-stone-700">{report.details}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="messages-heading" className="space-y-3">
        <h2 id="messages-heading" className="text-lg font-semibold">
          Messages
        </h2>
        <p className="text-xs text-stone-600">
          Text is shown as stored, with contact details already masked. Attachments are listed by name only.
        </p>
        {conversation.messages.length === 0 ? (
          <p className="text-sm text-stone-600">No messages yet.</p>
        ) : (
          <ol className="space-y-3">
            {conversation.messages.map((message) => (
              <li key={message.id} className="rounded border border-stone-300 bg-white p-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
                  <span className="font-medium text-stone-900">
                    {names.get(message.senderId) ?? "Unknown user"}
                    {roleOf.get(message.senderId) ? ` (${roleOf.get(message.senderId)?.toLowerCase()})` : ""}
                  </span>
                  <span>{MESSAGE_KIND_LABELS[message.kind]}</span>
                  <span>{formatDate(message.createdAt)}</span>
                  {message.flagged ? <span className="text-amber-800">Contact details masked</span> : null}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words">{message.body}</p>
                {message.attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-stone-600">
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
        {showingLimit ? <p className="text-xs text-stone-600">Showing the first 200 messages.</p> : null}
      </section>
    </div>
  );
}
