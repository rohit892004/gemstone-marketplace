import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="[date]">
      <LegalSection heading="1. The service">
        <p>
          Gemstone Selections is operated by [Company legal name], [registered address] (&ldquo;we&rdquo;). The site
          lets buyers browse gemstone listings and lets registered sellers list stones. Valuations on the site are
          indicative estimates and are not certified appraisals.
        </p>
      </LegalSection>
      <LegalSection heading="2. Accounts">
        <p>You must give accurate details, keep your sign-in secure, and tell us promptly if you suspect misuse. [Minimum age and eligibility rules.]</p>
      </LegalSection>
      <LegalSection heading="3. Listings and transactions">
        <p>
          Sellers are responsible for the accuracy of their listings and for any disclosures on treatment, origin and
          certification. [Describe how sales, payment and delivery are handled, and our role as intermediary or
          marketplace.]
        </p>
      </LegalSection>
      <LegalSection heading="4. Prohibited conduct">
        <ul>
          <li>Listing stones you do not own or have no right to sell.</li>
          <li>Misrepresenting treatment, weight, origin or certification.</li>
          <li>Abusing messaging, reviews, referrals or the valuation service.</li>
        </ul>
      </LegalSection>
      <LegalSection heading="5. Fees">
        <p>[Membership, listing and commission terms, and how they are charged. Sellers should also see the seller agreement.]</p>
      </LegalSection>
      <LegalSection heading="6. Disclaimers and liability">
        <p>[Disclaimer of warranties, limitation of liability and indemnity, to be drafted by counsel for the governing law.]</p>
      </LegalSection>
      <LegalSection heading="7. Governing law and disputes">
        <p>[Governing law, jurisdiction, and dispute resolution, including any arbitration clause.]</p>
      </LegalSection>
      <LegalSection heading="8. Changes and contact">
        <p>We may update these terms and will show the date of the latest version. Contact: [legal contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
