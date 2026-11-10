import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/newsletter/newsletter-signup";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { TOPIC_LABELS, NEWSLETTER_TOPICS } from "@/lib/newsletter/topics";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Sign up for the Gemstone Selections newsletter: education, market news, new listings and platform updates.",
};

/**
 * Split layout on wide screens: the copy and sign-up form on the left, a photograph on the right.
 * On phones the form comes first and the photo is a short banner after it.
 */
export default function NewsletterPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div className="space-y-10">
          <header className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Newsletter</p>
            <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">The Gemstone Selections newsletter</h1>
            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              A short email, sent weekly when there is something to say. You choose the topics. Nothing is sent until you
              confirm your address from the email we send you.
            </p>
          </header>

          <section aria-labelledby="what-heading" className="space-y-4">
            <h2 id="what-heading" className="font-heading text-2xl text-ink">What you will get</h2>
            <ul className="divide-y divide-line border-y border-line">
              {NEWSLETTER_TOPICS.map((topic) => (
                <li key={topic} className="py-3 text-sm leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">{TOPIC_LABELS[topic]}.</span>{" "}
                  {topic === "EDUCATION" && "New guides and reference pages on gemstones."}
                  {topic === "MARKET_NEWS" && "Market news, with the source of each item."}
                  {topic === "NEW_LISTINGS" && "Notable new stones from our verified sellers."}
                  {topic === "PLATFORM_UPDATES" && "What is new on Gemstone Selections."}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">
              Every email has links to change your topics or unsubscribe. We never share your address.
            </p>
          </section>

          <Card as="section" aria-labelledby="signup-heading" className="p-6 sm:p-8">
            <h2 id="signup-heading" className="mb-6 font-heading text-2xl text-ink">Sign up</h2>
            <NewsletterSignup source="newsletter-page" variant="page" />
          </Card>
        </div>

        <figure className="relative m-0">
          <Photo
            src="/design-preview/luxury/stone-detail-2.webp"
            alt="Faceted blue sapphire in an ornate silver pendant setting"
            ratio="aspect-[16/9] lg:aspect-[4/5]"
            zoomOnHover={false}
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-night/80 px-5 py-4 text-xs uppercase tracking-[0.2em] text-ivory">
            Sapphire, set in silver
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
