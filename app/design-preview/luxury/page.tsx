import { Cormorant_Garamond, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuxuryPreview } from "@/components/design-preview/luxury";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-lux-serif" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-lux-sans" });

export const metadata: Metadata = { title: "Luxury direction preview", robots: { index: false, follow: false } };

export default function LuxuryDesignPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className={`${serif.variable} ${sans.variable}`} style={{ fontFamily: "var(--font-lux-sans)" }}>
      <LuxuryPreview />
    </div>
  );
}
