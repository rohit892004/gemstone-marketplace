import type { Metadata } from "next";
import { ComingSoon } from "@/components/home/coming-soon";

export const metadata: Metadata = {
  title: "Learn",
  description: "Gemstone education guides are coming soon.",
};

export default function LearnPage() {
  return (
    <ComingSoon
      title="Learn about gemstones"
      description="Guides on grading, treatments and buying with confidence are on their way."
    />
  );
}
