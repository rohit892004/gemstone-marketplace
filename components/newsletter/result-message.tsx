import type { NewsletterActionResult } from "@/lib/newsletter/messages";

/** Result of a form action. Always rendered (empty when there is no result) so screen readers hear updates. */
export function ResultMessage({ result }: { result: NewsletterActionResult }) {
  return (
    <p role="status" aria-live="polite" className={result?.ok === false ? "text-sm text-red-700" : "text-sm text-ink"}>
      {result?.message ?? ""}
    </p>
  );
}
