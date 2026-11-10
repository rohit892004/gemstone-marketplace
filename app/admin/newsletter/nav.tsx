import { SectionTabs } from "@/components/admin/section-tabs";

const LINKS = [
  { href: "/admin/newsletter", label: "Overview" },
  { href: "/admin/newsletter/subscribers", label: "Subscribers" },
  { href: "/admin/newsletter/campaigns", label: "Campaigns" },
  { href: "/admin/newsletter/campaigns/new", label: "New campaign" },
];

export function NewsletterNav() {
  return <SectionTabs items={LINKS} label="Newsletter" />;
}
