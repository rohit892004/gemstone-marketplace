import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Photo } from "@/components/ui/photo";
import { CONTACT_TOPICS } from "@/lib/contact/topics";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a message to the Gemstone Selections team. We reply by email.",
};

/** Contact page: the form on the left, a short guide to the topics on the right (stacked on phones). */
export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Help"
        title="Contact the team"
        lead="Send us a message and we will reply by email. Please do not include card or bank details."
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-16">
        <Card as="section" aria-labelledby="contact-form-heading" className="p-6 sm:p-8">
          <h2 id="contact-form-heading" className="mb-6 font-heading text-2xl text-ink">
            Your message
          </h2>
          <ContactForm />
        </Card>

        <aside className="space-y-10" aria-labelledby="help-heading">
          <div className="space-y-4">
            <h2 id="help-heading" className="font-heading text-2xl text-ink">
              What we can help with
            </h2>
            <ul className="divide-y divide-line border-y border-line">
              {CONTACT_TOPICS.map((topic) => (
                <li key={topic.value} className="py-3 text-sm leading-relaxed text-ink">
                  {topic.label}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">Valuations are indicative estimates, not certified appraisals.</p>
          </div>

          <figure className="m-0 hidden lg:block">
            <Photo
              src="/design-preview/luxury/stone-detail-3.webp"
              alt=""
              ratio="aspect-[4/3]"
              zoomOnHover={false}
              sizes="22rem"
            />
          </figure>
        </aside>
      </div>
    </section>
  );
}
