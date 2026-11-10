import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Cookie notice" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie notice" updated="[date]">
      <LegalSection heading="Essential cookies">
        <p>
          The site uses cookies it cannot run without: a session cookie for sign-in (HTTP-only, set by the
          authentication library), and a notice cookie (gs_notice) that remembers you have seen the cookie notice.
        </p>
      </LegalSection>
      <LegalSection heading="Analytics cookie">
        <p>
          The site sets one first-party cookie, gs_vid. It holds a random identifier, not your name, email or any
          personal detail. It is HTTP-only, first-party only, and lasts one year. It lets us count unique visitors and
          page views per listing. We do not use advertising or third-party analytics cookies.
        </p>
      </LegalSection>
      <LegalSection heading="Managing cookies">
        <p>You can delete cookies in your browser at any time. Deleting the session cookie signs you out. [Consent requirements under applicable law, if any.]</p>
      </LegalSection>
      <LegalSection heading="Changes and contact">
        <p>We will update this notice if we add cookies. Questions: [privacy contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}
