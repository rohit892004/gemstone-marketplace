import type { Metadata } from "next";
import { ComingSoon } from "@/components/home/coming-soon";

export const metadata: Metadata = {
  title: "Get a valuation",
  description: "Indicative gemstone valuations are coming soon.",
};

export default function ValuationPage() {
  return (
    <ComingSoon
      title="Get a valuation"
      description="Indicative valuations for your gemstones are coming soon. Until then, browse listings or contact a seller directly."
    />
  );
}
