import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/newsletter/newsletter-signup";
import { TOPIC_LABELS, NEWSLETTER_TOPICS } from "@/lib/newsletter/topics";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Sign up for the Gemstone Selections newsletter: education, market news, new listings and platform updates.",
};

export default function NewsletterPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Newsletter</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">The Gemstone Selections newsletter</h1>
        <p className="text-ink-soft">
          A short email, sent weekly when there is something to say. You choose the topics. Nothing is sent until you
          confirm your address from the email we send you.
        </p>
      </header>

      <section aria-labelledby="what-heading" className="space-y-3">
        <h2 id="what-heading" className="text-xl font-semibold text-ink">What you will get</h2>
        <ul className="list-disc space-y-2 pl-5 text-ink-soft">
          {NEWSLETTER_TOPICS.map((topic) => (
            <li key={topic}>
              <span className="font-medium text-ink">{TOPIC_LABELS[topic]}.</span>{" "}
              {topic === "EDUCATION" && "New guides and reference pages on gemstones."}
              {topic === "MARKET_NEWS" && "Market news, with the source of each item."}
              {topic === "NEW_LISTINGS" && "Notable new stones from our verified sellers."}
              {topic === "PLATFORM_UPDATES" && "What is new on Gemstone Selections."}
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-soft">
          Every email has links to change your topics or unsubscribe. We never share your address.
        </p>
      </section>

      <section aria-labelledby="signup-heading" className="rounded-lg border border-line bg-surface-raised p-6">
        <h2 id="signup-heading" className="mb-4 text-xl font-semibold text-ink">Sign up</h2>
        <NewsletterSignup source="newsletter-page" variant="page" />
      </section>
    </section>
  );
}
