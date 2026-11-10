import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { NewsletterNav } from "./nav";

export const metadata = { title: "Newsletter", robots: { index: false, follow: false } };

export default function AdminNewsletterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading newsletter overview...</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await requirePageRole(["ADMIN"]);
  const [subscribers, campaigns, suppressed, lastDigest] = await Promise.all([
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.newsletterCampaign.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.emailSuppression.count(),
    prisma.newsletterDigestRun.findFirst({ orderBy: { sentAt: "desc" }, select: { periodKey: true, recipientCount: true, sentAt: true } }),
  ]);
  const subCount = (status: string) => subscribers.find((s) => s.status === status)?._count._all ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-4xl font-medium text-ink">Newsletter</h1>
      <NewsletterNav />

      <section aria-labelledby="subs-heading" className="space-y-3">
        <h2 id="subs-heading" className="font-heading text-2xl text-ink">Subscribers</h2>
        <dl className="grid gap-3 sm:grid-cols-4">
          <Stat label="Confirmed" value={subCount("CONFIRMED")} />
          <Stat label="Pending confirmation" value={subCount("PENDING")} />
          <Stat label="Unsubscribed" value={subCount("UNSUBSCRIBED")} />
          <Stat label="Suppressed addresses" value={suppressed} />
        </dl>
      </section>

      <section aria-labelledby="campaigns-heading" className="space-y-3">
        <h2 id="campaigns-heading" className="font-heading text-2xl text-ink">Campaigns</h2>
        <dl className="grid gap-3 sm:grid-cols-5">
          {(["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"] as const).map((status) => (
            <Stat key={status} label={status.toLowerCase()} value={campaigns.find((c) => c.status === status)?._count._all ?? 0} />
          ))}
        </dl>
      </section>

      <section aria-labelledby="digest-heading" className="space-y-2">
        <h2 id="digest-heading" className="font-heading text-2xl text-ink">Weekly digest</h2>
        <p className="text-sm text-ink-soft">
          {lastDigest
            ? `Last run: ${lastDigest.periodKey}, ${lastDigest.recipientCount} recipients, ${lastDigest.sentAt.toISOString()}.`
            : "No digest has been sent yet."}
        </p>
      </section>
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
