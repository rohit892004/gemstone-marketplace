import type { Metadata } from "next";
import { Suspense } from "react";
import { StartValuationButton } from "@/components/valuation/start-valuation-button";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { Disclaimer, Panel } from "@/components/valuation/ui";
import { requesterState } from "./guard";
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from "@/lib/valuation/requester-copy";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";

export const metadata: Metadata = {
  title: "Gemstone valuation",
  description: "Request an indicative valuation for your gemstone. Automatic estimates, with expert review when it is needed.",
};

export default function ValuationPage() {
  return (
    <Suspense fallback={null}>
      <Landing />
    </Suspense>
  );
}

async function Landing() {
  const state = await requesterState();
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Valuation</p>
      <h1 className="mt-3 font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Get an indicative valuation</h1>
      <p className="mt-4 text-ink-soft">
        Tell us about a gemstone and add photos. You get an indicative estimate with a value range and a confidence level, based on reference prices and the details you give.
        When the stone needs a closer look, or you ask for it, an expert valuer reviews the request and signs off the result.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Step n={1} title="Upload" text="Add the stone details and at least one photo." />
        <Step n={2} title="Review" text="Check the summary. Choose whether an expert should review it." />
        <Step n={3} title="Result" text="See the estimate and download the PDF report." />
      </div>

      <div className="mt-8">
        <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
      </div>

      <div className="mt-8">
        {state.kind === "allowed" ? (
          <Panel title="Start a valuation" id="start-heading">
            <p className="text-sm text-ink-soft">You can come back to a draft at any time from your account.</p>
            <StartValuationButton />
            <p className="text-sm text-ink-soft">
              Valuations for stones listed on the site are started from the stone&apos;s own page, so its details and photos are copied in.
            </p>
          </Panel>
        ) : (
          <RequesterAccessMessage state={state} returnTo={REQUESTER_PATHS.landing} />
        )}
      </div>
    </section>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="border border-line bg-surface-raised p-4">
      <p className="text-sm font-medium text-accent-text">Step {n}</p>
      <h2 className="mt-1 font-medium text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{text}</p>
    </div>
  );
}
