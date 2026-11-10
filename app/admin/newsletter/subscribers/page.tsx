import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TOPIC_LABELS, type NewsletterTopicName } from "@/lib/newsletter/topics";
import { NewsletterNav } from "../nav";

export const metadata = { title: "Newsletter subscribers", robots: { index: false, follow: false } };

const STATUSES = ["ALL", "CONFIRMED", "PENDING", "UNSUBSCRIBED"] as const;
type StatusFilter = (typeof STATUSES)[number];

/**
 * Subscriber list. No IP addresses are shown or stored here: the consent log keeps only salted hashes,
 * and this page does not read it.
 */
export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: StatusFilter = (STATUSES as readonly string[]).includes(status ?? "") ? (status as StatusFilter) : "ALL";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Newsletter subscribers</h1>
      <NewsletterNav />
      <nav aria-label="Filter by status" className="flex gap-2 text-sm">
        {STATUSES.map((s) => (
          <a
            key={s}
            href={s === "ALL" ? "/admin/newsletter/subscribers" : `/admin/newsletter/subscribers?status=${s}`}
            aria-current={s === filter ? "page" : undefined}
            className={`rounded border px-3 py-1 ${s === filter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-800"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </a>
        ))}
      </nav>
      <Suspense fallback={<p className="text-sm text-stone-600">Loading subscribers...</p>}>
        <List filter={filter} />
      </Suspense>
    </div>
  );
}

async function List({ filter }: { filter: StatusFilter }) {
  await requirePageRole(["ADMIN"]);
  const rows = await prisma.newsletterSubscriber.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { email: true, status: true, topics: true, source: true, confirmedAt: true, createdAt: true },
  });
  if (rows.length === 0) return <p className="text-sm text-stone-600">No subscribers match this filter yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">Newsletter subscribers, newest first, up to 200</caption>
        <thead className="border-b border-stone-300 text-stone-600">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">Email</th>
            <th scope="col" className="py-2 pr-4 font-medium">Status</th>
            <th scope="col" className="py-2 pr-4 font-medium">Topics</th>
            <th scope="col" className="py-2 pr-4 font-medium">Source</th>
            <th scope="col" className="py-2 pr-4 font-medium">Confirmed</th>
            <th scope="col" className="py-2 font-medium">Signed up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.email} className="border-b border-stone-200">
              <td className="py-2 pr-4 break-all">{row.email}</td>
              <td className="py-2 pr-4">{row.status.toLowerCase()}</td>
              <td className="py-2 pr-4">{row.topics.map((t) => TOPIC_LABELS[t as NewsletterTopicName]).join(", ") || "none"}</td>
              <td className="py-2 pr-4">{row.source}</td>
              <td className="py-2 pr-4 tabular-nums">{row.confirmedAt ? row.confirmedAt.toISOString().slice(0, 10) : "not yet"}</td>
              <td className="py-2 tabular-nums">{row.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
