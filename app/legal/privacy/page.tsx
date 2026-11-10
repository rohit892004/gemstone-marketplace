import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="[date]">
      <LegalSection heading="1. Who we are">
        <p>
          The data controller is [Company legal name], [registered address]. Grievance officer: [name, role, contact].
          [Data Protection Officer details, if required.]
        </p>
      </LegalSection>
      <LegalSection heading="2. What we collect">
        <ul>
          <li>Account details: name, email address, mobile number (verified by one-time code).</li>
          <li>Seller details: business information and identity documents you upload. Stored privately.</li>
          <li>Messages, listings, enquiries and valuation requests you submit.</li>
          <li>Usage data: page views and actions recorded against a random visitor identifier (see the cookie notice).</li>
          <li>Technical records: IP address used for security, rate limiting and the audit log.</li>
        </ul>
      </LegalSection>
      <LegalSection heading="3. Why we use it">
        <p>[Lawful basis for each purpose: providing the service, security, communications, analytics, legal duties.]</p>
      </LegalSection>
      <LegalSection heading="4. Sharing">
        <p>
          We share data with service providers that run the site: hosting, database, email delivery, SMS delivery and
          file storage. [List processors and countries.] We do not sell personal data.
        </p>
      </LegalSection>
      <LegalSection heading="5. Retention">
        <p>[Retention periods for accounts, documents, messages, analytics events (raw events are deleted after 90 days) and logs.]</p>
      </LegalSection>
      <LegalSection heading="6. Security">
        <p>Passwords are hashed. Documents are stored privately and served only to authorised users. [Describe encryption and access controls.]</p>
      </LegalSection>
      <LegalSection heading="7. Your rights">
        <p>[Access, correction, deletion, portability and objection rights, and how to exercise them, under applicable law.]</p>
      </LegalSection>
      <LegalSection heading="8. Children">
        <p>The service is not directed to children. [Age limit under applicable law.]</p>
      </LegalSection>
      <LegalSection heading="9. Changes and contact">
        <p>[How we notify changes.] Questions and requests: [privacy contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
