import type { Metadata } from "next";
import { ComingSoon } from "@/components/home/coming-soon";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "The Gemstone Selections newsletter is coming soon.",
};

export default function NewsletterPage() {
  return (
    <ComingSoon
      title="Newsletter"
      description="A monthly digest of new listings and market notes. Sign-ups open soon. We are not storing email addresses yet."
    />
  );
}
