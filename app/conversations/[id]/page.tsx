import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { getConversationForParticipant, isBlockedEitherWay, MESSAGING_ROLES, otherParticipantIds } from "@/lib/messaging/access";
import { conversationSide } from "@/lib/messaging/side";
import { listMessagesSince } from "@/lib/messaging/service";
import { ChatThread, type ThreadMessage } from "@/components/messaging/chat-thread";
import { SafetyActions } from "@/components/messaging/safety-actions";
import type { ThreadContext } from "@/components/messaging/types";
import { quotationSides } from "@/lib/quotations/validate";

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(MESSAGING_ROLES, { sellerApproved: true });
  const { id } = await params;

  const conversation = await getConversationForParticipant(id, user.id);
  if (!conversation) notFound(); // non-participants and missing IDs look the same

  const [counterpartId] = otherParticipantIds(conversation, user.id);
  const counterpart = conversation.participants.find((p) => p.userId === counterpartId)?.user;
  const counterpartLabel = counterpart?.sellerProfile?.businessName ?? counterpart?.name ?? "Member";
  const blocked = counterpartId ? await isBlockedEitherWay(user.id, counterpartId) : false;

  const feed = await listMessagesSince(id, user.id, null, 200);
  const messages: ThreadMessage[] = (feed?.messages ?? []).map((m) => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    flagged: m.flagged,
    createdAt: m.createdAt.toISOString(),
    mine: m.senderId === user.id,
    attachments: m.attachments,
    offer: m.offer ? { ...m.offer, amountMinor: m.offer.amountMinor.toString() } : null,
    quotation: m.quotation
      ? {
          ...m.quotation,
          amountMinor: m.quotation.amountMinor.toString(),
          validUntil: m.quotation.validUntil?.toISOString() ?? null,
        }
      : null,
  }));

  const context: ThreadContext = {
    conversationId: id,
    kind: conversation.kind,
    viewerId: user.id,
    // The side decides the controls: a seller enquiring on another seller's listing is the buyer here.
    viewerRole: conversationSide(conversation, user.id) === "BUYING" ? "BUYER" : "SELLER",
    canQuote: quotationSides(conversation, user.id)?.viewerIsSeller === true,
    counterpartId: counterpartId ?? null,
    isDemo: conversation.isDemo,
    gemstone: conversation.gemstone ? { id: conversation.gemstone.id, title: conversation.gemstone.title, slug: conversation.gemstone.slug } : null,
    requirement: conversation.requirement
      ? { id: conversation.requirement.id, gemstoneType: conversation.requirement.gemstoneType, status: conversation.requirement.status }
      : null,
  };

  const closedRequirement = conversation.requirement?.status === "CLOSED";
  const disabledReason = blocked
    ? "You can't send messages in this conversation."
    : closedRequirement
      ? "This requirement is closed, so the conversation is read only."
      : null;

  const subject = conversation.gemstone
    ? { label: conversation.gemstone.title, href: `/gemstones/${conversation.gemstone.slug}` }
    : conversation.requirement
      ? { label: `Requirement: ${conversation.requirement.gemstoneType}`, href: null }
      : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/conversations" className="text-sm text-brand hover:underline">
        ← All conversations
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent-text">
            {conversation.kind === "ENQUIRY" ? "Enquiry" : conversation.kind === "REQUIREMENT" ? "Requirement" : "Conversation"}
            {conversation.isDemo && " · Demo"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{counterpartLabel}</h1>
          {subject && (
            <p className="mt-1 text-sm text-ink-soft">
              {subject.href ? <Link href={subject.href} className="text-brand hover:underline">{subject.label}</Link> : subject.label}
            </p>
          )}
        </div>
        {counterpartId && <SafetyActions conversationId={id} blocked={blocked} />}
      </div>
      <div className="mt-6">
        <ChatThread
          conversationId={id}
          initialMessages={messages}
          initialCounterpartLastReadAt={feed?.counterpartLastReadAt?.toISOString() ?? null}
          counterpartLabel={counterpartLabel}
          isDemo={conversation.isDemo}
          disabledReason={disabledReason}
          context={context}
        />
      </div>
    </section>
  );
}
