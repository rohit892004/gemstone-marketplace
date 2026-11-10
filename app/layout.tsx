import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { getEnv } from "@/lib/config/env";
import "./globals.css";

// Luxury type system: a high-contrast serif for headings, a clean sans for body text (self-hosted at build time).
const headingFont = Cormorant_Garamond({ variable: "--font-lux-serif", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
const bodyFont = Inter({ variable: "--font-lux-sans", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  // Absolute URLs for Open Graph and sitemap entries.
  metadataBase: new URL(getEnv().APP_URL),
  title: {
    default: "Gemstone Selections",
    template: "%s | Gemstone Selections",
  },
  description: "A marketplace for certified and coloured gemstones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface-raised focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <CookieNotice />
      </body>
    </html>
  );
}
