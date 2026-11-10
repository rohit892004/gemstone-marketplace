"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";

/**
 * Last-resort boundary for errors in the root layout. Replaces the whole document, so it carries its own
 * html and body and cannot use the site header, footer or stylesheet. Uses the luxury palette inline.
 * Shows no error details.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError(error.digest);
  }, [error]);

  const ink = "#1c1a17";
  const gold = "#8a6d43";

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f4ee", color: ink }}>
        <main style={{ maxWidth: "36rem", margin: "0 auto", padding: "7rem 1.25rem", textAlign: "center" }}>
          <p style={{ color: gold, fontSize: "0.75rem", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "2.25rem", lineHeight: 1.15 }}>
            The site could not load
          </h1>
          <p style={{ color: "#6b655a", lineHeight: 1.6 }}>Please try again in a moment.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ minHeight: "2.75rem", padding: "0.75rem 1.5rem", background: ink, color: "#f4f0e8", border: 0, letterSpacing: "0.02em", cursor: "pointer" }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{ display: "inline-flex", alignItems: "center", minHeight: "2.75rem", padding: "0.75rem 1.5rem", border: `1px solid ${ink}`, color: ink, textDecoration: "none" }}
            >
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
