import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoNotice, EmptyState } from "@/components/content/content-ui";
import { listPublicReferenceEntries } from "@/lib/content/service";

export const metadata: Metadata = {
  title: "Gemstone Reference Library",
  description: "Properties, origins, treatments, quality and price factors for each gemstone we list.",
};

export default function ReferenceIndexPage() {
  return (
    <Suspense fallback={null}>
      <ReferenceList />
    </Suspense>
  );
}

async function ReferenceList() {
  // Request-time: new reference pages appear as soon as they are published.
  await connection();
  const entries = await listPublicReferenceEntries();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Gemstone Reference Library</h1>
        <p className="text-ink-soft">
          One page per gemstone: its properties, where it comes from, how it is treated, how to judge quality, how to care
          for it and what moves the price.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          body="Reference pages are being written and checked by our team. Check back soon."
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <article className="flex h-full flex-col gap-3 border border-line bg-surface-raised p-5">
                <h2 className="font-heading text-2xl text-ink">
                  <Link href={`/reference/${entry.slug}`} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    {entry.name}
                  </Link>
                </h2>
                <p className="text-sm text-ink-soft">{entry.summary}</p>
                {entry.hardness ? <p className="text-xs text-ink-soft">Hardness: {entry.hardness}</p> : null}
                {entry.isDemo ? <DemoNotice className="mt-auto self-start" /> : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
