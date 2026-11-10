import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Seller agreement" };

export default function SellerAgreementPage() {
  return (
    <LegalPage title="Seller agreement" updated="[date]">
      <LegalSection heading="1. Parties and scope">
        <p>This agreement is between [Company legal name] (the platform) and each seller who registers on the site.</p>
      </LegalSection>
      <LegalSection heading="2. Seller obligations">
        <ul>
          <li>Provide accurate listings, photographs and disclosures, and keep them up to date.</li>
          <li>Hold legal title to, or authority to sell, every listed stone.</li>
          <li>Upload genuine identity and business documents.</li>
          <li>Respond to buyer enquiries in good faith and within [response time].</li>
        </ul>
      </LegalSection>
      <LegalSection heading="3. Listing limits and membership">
        <p>[Membership tiers, listing limits, and how pending review counts toward the limit. Subject to client confirmation.]</p>
      </LegalSection>
      <LegalSection heading="4. Fees and payment">
        <p>[Commission, listing fees, invoicing, taxes, and payment timing.]</p>
      </LegalSection>
      <LegalSection heading="5. Verification and suspension">
        <p>We may verify sellers, reject or remove listings, and suspend accounts that breach this agreement. [Notice and appeal process.]</p>
      </LegalSection>
      <LegalSection heading="6. Disclosures and warranties">
        <p>[Warranties on treatment, origin and certification, and the seller&rsquo;s indemnity for breach.]</p>
      </LegalSection>
      <LegalSection heading="7. Data and confidentiality">
        <p>Use of buyer and platform data is governed by the privacy policy. [Confidentiality of buyer contact details.]</p>
      </LegalSection>
      <LegalSection heading="8. Liability, term and governing law">
        <p>[Limitation of liability, termination, and governing law and jurisdiction.]</p>
      </LegalSection>
    </LegalPage>
  );
}
