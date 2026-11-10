import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { renderMarkdown } from "@/lib/content/markdown";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";
import { NewsletterNav } from "../../nav";
import { CampaignForm } from "../../campaign-form";
import { cancelCampaignAction, scheduleCampaignAction, sendTestCampaignAction, updateCampaignAction } from "../../actions";

export const metadata = { title: "Newsletter campaign", robots: { index: false, follow: false } };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-8">
      <NewsletterNav />
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading campaign...</p>}>
        <Detail id={id} />
      </Suspense>
    </div>
  );
}

async function Detail({ id }: { id: string }) {
  await requirePageRole(["ADMIN"]);
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      preheader: true,
      body: true,
      topics: true,
      status: true,
      scheduledFor: true,
      testSentAt: true,
      startedAt: true,
      sentAt: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      skippedCount: true,
    },
  });
  if (!campaign) notFound();

  // Live counts from the send rows, so a campaign that is still sending shows progress.
  const groups = await prisma.newsletterSend.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } });
  const count = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  const editable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  const scheduledValue = campaign.scheduledFor ? campaign.scheduledFor.toISOString().slice(0, 16) : "";
  const topicLabels = campaign.topics.map((t) => TOPIC_LABELS[t as NewsletterTopicName]).join(", ");

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-heading text-4xl font-medium text-ink">{campaign.subject}</h1>
        <p className="text-sm text-ink-soft">
          Status: <strong>{campaign.status.toLowerCase()}</strong>. Topics: {topicLabels}.
        </p>
        {campaign.scheduledFor ? <p className="text-sm text-ink-soft">Scheduled for {campaign.scheduledFor.toISOString()} (UTC).</p> : null}
        {campaign.testSentAt ? <p className="text-sm text-ink-soft">Last test sent {campaign.testSentAt.toISOString()}.</p> : null}
      </header>

      <section aria-labelledby="stats-heading" className="space-y-3">
        <h2 id="stats-heading" className="font-heading text-2xl text-ink">Send stats</h2>
        <dl className="grid gap-3 sm:grid-cols-5">
          <Stat label="Queued" value={count("QUEUED")} />
          <Stat label="Sent" value={count("SENT")} />
          <Stat label="Failed" value={count("FAILED")} />
          <Stat label="Skipped" value={count("SKIPPED")} />
          <Stat label="Recipients" value={campaign.recipientCount} />
        </dl>
        {campaign.sentAt ? (
          <p className="text-sm text-ink-soft">Finished {campaign.sentAt.toISOString()}. Final counts: {campaign.sentCount} sent, {campaign.failedCount} failed, {campaign.skippedCount} skipped.</p>
        ) : campaign.startedAt ? (
          <p className="text-sm text-ink-soft">Sending started {campaign.startedAt.toISOString()}.</p>
        ) : null}
      </section>

      <section aria-labelledby="preview-heading" className="space-y-3">
        <h2 id="preview-heading" className="font-heading text-2xl text-ink">Preview</h2>
        <p className="text-sm text-ink-soft">Preheader: {campaign.preheader ?? "none"}</p>
        {/* Output of renderMarkdown: the strict sanitiser in lib/content/markdown.ts. Never raw input. */}
        <div className="prose max-w-none border border-line bg-surface-raised p-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(campaign.body) }} />
        <p className="text-[12px] text-ink-soft">The footer with the preferences and unsubscribe links is added to every email at send time.</p>
      </section>

      {editable ? (
        <section aria-labelledby="edit-heading" className="space-y-3">
          <h2 id="edit-heading" className="font-heading text-2xl text-ink">Edit</h2>
          <CampaignForm
            action={updateCampaignAction}
            submitLabel="Save changes"
            defaults={{
              id: campaign.id,
              subject: campaign.subject,
              preheader: campaign.preheader,
              body: campaign.body,
              topics: campaign.topics,
            }}
          />
        </section>
      ) : null}

      <section aria-labelledby="test-heading" className="space-y-3">
        <h2 id="test-heading" className="font-heading text-2xl text-ink">Test</h2>
        <ActionForm
          action={sendTestCampaignAction}
          title="Send a test to me"
          description="Sends one copy to your admin email. The campaign and its send list are not changed."
          submitLabel="Send test"
          hidden={{ id: campaign.id }}
        />
      </section>

      {editable ? (
        <section aria-labelledby="schedule-heading" className="space-y-3">
          <h2 id="schedule-heading" className="font-heading text-2xl text-ink">Schedule</h2>
          <ActionForm
            action={scheduleCampaignAction}
            title="Schedule the send"
            description="The send time is in UTC. Recipients are fixed when the campaign starts sending, so subscribers who confirm later are not included."
            submitLabel="Schedule"
            hidden={{ id: campaign.id }}
            fields={[
              {
                name: "scheduledFor",
                label: "Send at (UTC), YYYY-MM-DDTHH:MM",
                defaultValue: scheduledValue,
                required: true,
                help: "Example: 2026-11-16T09:00 sends at 09:00 UTC.",
              },
            ]}
          />
          <ActionForm
            action={cancelCampaignAction}
            title="Cancel this campaign"
            description="Cancelled campaigns are never sent. Once sending has started, a campaign cannot be cancelled."
            submitLabel="Cancel campaign"
            hidden={{ id: campaign.id }}
            tone="danger"
          />
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-surface-raised p-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-heading text-4xl font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
