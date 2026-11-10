import type { Metadata } from "next";
import { Suspense } from "react";
import { StartValuationButton } from "@/components/valuation/start-valuation-button";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { Disclaimer, EstimateNote, Panel } from "@/components/valuation/ui";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Reveal } from "@/components/ui/reveal";
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

/** Stand-in photograph from public/design-preview/luxury (see docs/design/IMAGE-CREDITS.md). */
const HERO_PHOTO = "/design-preview/luxury/hero-stone-closeup.webp";

const STEPS = [
  { n: "01", title: "Upload", text: "Add the stone details and at least one photo." },
  { n: "02", title: "Review", text: "Check the summary. Choose whether an expert should review it." },
  { n: "03", title: "Result", text: "See the estimate and download the PDF report." },
] as const;

async function Landing() {
  const state = await requesterState();
  return (
    <>
      {/* Opening band: charcoal, photograph and the start point. */}
      <section className="bg-night text-ivory">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16 lg:py-28">
          <div className="space-y-8">
            <PageHeader
              tone="dark"
              eyebrow="Valuation"
              title="Get an indicative valuation"
              className="pb-0"
              lead={
                <p className="text-ivory/75">
                  Tell us about a gemstone and add photos. You get an indicative estimate with a value range and a confidence level, based on reference prices and
                  the details you give. When the stone needs a closer look, or you ask for it, an expert valuer reviews the request and signs off the result.
                </p>
              }
            />
            <div>
              <ButtonLink href="#start" variant="gold" className="min-h-11">
                Start a valuation
              </ButtonLink>
            </div>
          </div>
          <Photo
            src={HERO_PHOTO}
            alt="Close-up of a gemstone against a dark background"
            ratio="aspect-[4/5]"
            zoomOnHover={false}
            priority
            className="w-full"
            sizes="(min-width: 1024px) 440px, 100vw"
          />
        </div>
      </section>

      {/* How it works: three numbered steps. */}
      <section className="border-b border-line">
        <Reveal className="mx-auto max-w-7xl space-y-12 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title="Three steps to an estimate" />
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <li key={step.n} className="space-y-3 border-t border-accent pt-6">
                <p className="font-heading text-4xl leading-none text-accent-text" aria-hidden>
                  {step.n}
                </p>
                <p className="sr-only">Step {Number(step.n)}</p>
                <h3 className="font-heading text-2xl text-ink">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Indicative or certified: what each one is. */}
      <section className="border-b border-line bg-surface-raised">
        <Reveal className="mx-auto max-w-7xl space-y-12 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Know the difference" title="Indicative or certified" />
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4 p-6 sm:p-8">
              <Badge tone="neutral">Indicative</Badge>
              <h3 className="font-heading text-2xl text-ink">This valuation</h3>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                An estimate of value with a range and a confidence level. It uses reference prices and the details you give. Expert review adds a valuer&apos;s
                sign-off to the estimate. It is still an indicative valuation, not a certificate.
              </p>
            </Card>
            <Card className="space-y-4 p-6 sm:p-8">
              <Badge tone="verified">Certified</Badge>
              <h3 className="font-heading text-2xl text-ink">Laboratory report</h3>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                A report from an independent gemstone laboratory that identifies the stone and grades it, with its own certificate number. If you have one,
                add it to your request. A lab report is separate from this valuation.
              </p>
            </Card>
          </div>
        </Reveal>
      </section>

      {/* Call to action. */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="space-y-8 self-start">
            <SectionHeading eyebrow="Before you start" title="About the estimate" />
            <EstimateNote title="How the estimate is made" text="Expert review takes longer. A valuer may ask one question before signing off the result." />
            <Disclaimer title={DISCLAIMER_TITLE} text={DISCLAIMER_TEXT} />
          </div>
          <div id="start" className="self-start">
            {state.kind === "allowed" ? (
              <Panel title="Start a valuation" id="start-heading">
                <p className="text-sm leading-relaxed text-ink-soft">You can come back to a draft at any time from your account.</p>
                <StartValuationButton />
                <p className="text-sm leading-relaxed text-ink-soft">
                  Valuations for stones listed on the site are started from the stone&apos;s own page, so its details and photos are copied in.
                </p>
              </Panel>
            ) : (
              <RequesterAccessMessage state={state} returnTo={REQUESTER_PATHS.landing} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
