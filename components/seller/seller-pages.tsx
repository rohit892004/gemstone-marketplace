import Link from "next/link";
import { StatusCard } from "./status-card";

/** Placeholder body for approved-only seller areas that are built in later milestones. */
export function ComingLaterPage({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-4 text-ink-soft">Coming in a later milestone.</p>
    </section>
  );
}

/**
 * Shown to PENDING and REJECTED sellers on approved-only areas. Deliberately generic:
 * it reveals nothing about the area's content or the seller's documents.
 */
export function AwaitingApprovalPage({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <div className="mt-6">
        <StatusCard title="This area opens after approval">
          <p>This section becomes available once your seller application has been approved.</p>
          <p>
            <Link href="/seller" className="font-medium text-brand underline">
              Back to your seller account
            </Link>
          </p>
        </StatusCard>
      </div>
    </section>
  );
}
