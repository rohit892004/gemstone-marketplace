"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";

/**
 * Last-resort boundary for errors in the root layout. Replaces the whole document, so it carries its own
 * html and body and cannot use the site header or footer. Shows no error details.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportClientError(error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#0f1f1a" }}>
        <main style={{ maxWidth: "36rem", margin: "0 auto", padding: "6rem 1rem", textAlign: "center" }}>
          <p style={{ color: "#b8892b", fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 600 }}>The site could not load</h1>
          <p style={{ color: "#3d4f48" }}>Please try again in a moment.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
            <button type="button" onClick={() => reset()} style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", background: "#0b5d4b", color: "#ffffff", border: 0 }}>
              Try again
            </button>
            <Link href="/" style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #e4e1d8", color: "#074538" }}>
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
