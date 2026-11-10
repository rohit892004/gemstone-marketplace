import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";
import { NewsletterNav } from "../nav";

export const metadata = { title: "Newsletter campaigns", robots: { index: false, follow: false } };

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Newsletter campaigns</h1>
      <NewsletterNav />
      <Suspense fallback={<p className="text-sm text-stone-600">Loading campaigns...</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await requirePageRole(["ADMIN"]);
  const rows = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, subject: true, status: true, topics: true, scheduledFor: true, sentAt: true, recipientCount: true },
  });
  if (rows.length === 0) return <p className="text-sm text-stone-600">No campaigns yet. Create the first one from New campaign.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">Campaigns, newest first, up to 100</caption>
        <thead className="border-b border-stone-300 text-stone-600">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">Subject</th>
            <th scope="col" className="py-2 pr-4 font-medium">Status</th>
            <th scope="col" className="py-2 pr-4 font-medium">Topics</th>
            <th scope="col" className="py-2 pr-4 font-medium">Scheduled (UTC)</th>
            <th scope="col" className="py-2 pr-4 font-medium">Sent</th>
            <th scope="col" className="py-2 font-medium">Recipients</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-stone-200">
              <td className="py-2 pr-4">
                <Link href={`/admin/newsletter/campaigns/${row.id}`} className="underline underline-offset-4">{row.subject}</Link>
              </td>
              <td className="py-2 pr-4">{row.status.toLowerCase()}</td>
              <td className="py-2 pr-4">{row.topics.map((t) => TOPIC_LABELS[t as NewsletterTopicName]).join(", ")}</td>
              <td className="py-2 pr-4 tabular-nums">{row.scheduledFor ? row.scheduledFor.toISOString().slice(0, 16).replace("T", " ") : "not scheduled"}</td>
              <td className="py-2 pr-4 tabular-nums">{row.sentAt ? row.sentAt.toISOString().slice(0, 16).replace("T", " ") : "not yet"}</td>
              <td className="py-2 tabular-nums">{row.recipientCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
