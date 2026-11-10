import Link from "next/link";
import { requesterState } from "@/app/valuation/guard";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { StartValuationButton } from "./start-valuation-button";

/**
 * The "Request valuation" control on a product page. Buyers and approved sellers get the button, which starts a
 * draft prefilled from this listing. Everyone else gets a clear reason instead.
 */
export async function RequestValuationSlot({ gemstoneId, slug }: { gemstoneId: string; slug: string }) {
  const state = await requesterState();
  switch (state.kind) {
    case "allowed":
      return (
        <div className="space-y-2">
          <StartValuationButton gemstoneId={gemstoneId} label="Request valuation" />
          <p className="text-xs text-ink-soft">An indicative estimate for this stone. Your photos go to an expert valuer when one is needed.</p>
        </div>
      );
    case "signed-out":
      return (
        <div className="space-y-2">
          <Link
            href={REQUESTER_PATHS.login(`/gemstones/${slug}`)}
            className="block w-full rounded-md border border-brand px-4 py-2.5 text-center text-sm font-medium text-brand-strong hover:bg-accent-soft"
          >
            Sign in to request a valuation
          </Link>
          <p className="text-xs text-ink-soft">Valuations are available to buyers and approved sellers.</p>
        </div>
      );
    case "not-approved":
      return <p className="self-center text-xs text-ink-soft">Your seller account is under review. Valuations open once it is approved.</p>;
    case "unverified":
      return <p className="self-center text-xs text-ink-soft">Verify your email address to request a valuation.</p>;
    case "suspended":
      return <p className="self-center text-xs text-ink-soft">Your account is suspended, so you cannot request a valuation.</p>;
    default:
      return <p className="self-center text-xs text-ink-soft">Valuations are available to buyers and approved sellers.</p>;
  }
}
