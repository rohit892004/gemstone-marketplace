import type { Metadata } from "next";
import { ComingSoon } from "@/components/home/coming-soon";

export const metadata: Metadata = {
  title: "Market news",
  description: "Gemstone market news is coming soon.",
};

export default function NewsPage() {
  return (
    <ComingSoon
      title="Market news"
      description="Price movements and trade news from the gemstone market will appear here."
    />
  );
}
