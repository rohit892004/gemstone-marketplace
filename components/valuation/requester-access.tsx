import Link from "next/link";
import type { RequesterState } from "@/app/valuation/guard";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { AccessMessage } from "./ui";

/** What a visitor sees instead of a valuation page, for every state that is not "allowed". */
export function RequesterAccessMessage({ state, returnTo, title = "Valuations" }: { state: RequesterState; returnTo: string; title?: string }) {
  switch (state.kind) {
    case "signed-out":
      return (
        <AccessMessage
          title="Sign in to request a valuation"
          action={
            <Link href={REQUESTER_PATHS.login(returnTo)} className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
              Sign in
            </Link>
          }
        >
          <p>Valuations are available to buyers and approved sellers. You can sign in or create a buyer account.</p>
        </AccessMessage>
      );
    case "unverified":
      return (
        <AccessMessage title="Verify your email first">
          <p>Verify your email address, then you can request a valuation.</p>
        </AccessMessage>
      );
    case "suspended":
      return (
        <AccessMessage title="Your account is suspended">
          <p>You cannot request valuations while your account is suspended.</p>
        </AccessMessage>
      );
    case "not-approved":
      return (
        <AccessMessage title="Your seller account is under review">
          <p>Valuations open once your seller account is approved. You will be able to request them then.</p>
        </AccessMessage>
      );
    case "allowed":
      return null;
    default:
      return (
        <AccessMessage title={`${title} are not available for this account`}>
          <p>Valuations are available to buyers and approved sellers.</p>
        </AccessMessage>
      );
  }
}
