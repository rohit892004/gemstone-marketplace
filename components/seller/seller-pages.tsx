import Link from "next/link";
import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusCard } from "./status-card";

/**
 * Shown to PENDING and REJECTED sellers on approved-only areas. Deliberately generic:
 * it reveals nothing about the area's content or the seller's documents.
 */
export function AwaitingApprovalPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="font-heading text-4xl text-ink">{title}</h1>
      <EmptyState
        icon={Lock}
        title="This area opens after approval"
        body="This section becomes available once your seller application has been approved. Your seller account is where you can check progress."
        action={
          <ButtonLink href="/seller" variant="secondary">
            Back to your seller account
          </ButtonLink>
        }
      />
      <StatusCard title="Why you cannot open this yet">
        <p>
          <Link href="/seller" className="font-medium text-ink underline underline-offset-4 underline-offset-4">
            Return to your seller account
          </Link>{" "}
          to see the current status of your application.
        </p>
      </StatusCard>
    </div>
  );
}
