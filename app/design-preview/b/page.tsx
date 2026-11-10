import { Sora } from "next/font/google";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DesignPreview } from "@/components/design-preview/design-preview";
import { THEMES } from "@/components/design-preview/themes";

const heading = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

export const metadata: Metadata = { title: "Design direction B", robots: { index: false, follow: false } };

export default function DesignB() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className={heading.variable}>
      <DesignPreview theme={THEMES.b} />
    </div>
  );
}
