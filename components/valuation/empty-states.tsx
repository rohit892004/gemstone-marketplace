import { Gem } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

/** Empty states for the valuation lists. Server-safe. Each one gives the next step. */
export function EmptyValuations() {
  return (
    <EmptyState
      icon={Gem}
      title="No valuation requests yet"
      body="Start a valuation to get an indicative estimate for a stone. You can also request one from any listing."
      action={
        <ButtonLink href="/valuation" variant="secondary" className="min-h-11">
          How valuations work
        </ButtonLink>
      }
    />
  );
}

export function EmptyReports() {
  return (
    <EmptyState
      icon={Gem}
      title="No saved reports yet"
      body="When a valuation is complete, its report and PDF appear here."
      action={
        <ButtonLink href="/valuation" variant="secondary" className="min-h-11">
          Go to valuations
        </ButtonLink>
      }
    />
  );
}
