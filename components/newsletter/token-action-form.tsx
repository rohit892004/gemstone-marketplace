"use client";

import { useActionState } from "react";
import type { NewsletterActionResult } from "@/lib/newsletter/messages";
import { ResultMessage } from "./result-message";

/** A single-button form that posts a signed token to a server action (confirm, unsubscribe). */
export function TokenActionForm({
  action,
  token,
  label,
  tone = "primary",
}: {
  action: (prev: NewsletterActionResult, formData: FormData) => Promise<NewsletterActionResult>;
  token: string;
  label: string;
  tone?: "primary" | "danger";
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const buttonClass =
    tone === "danger"
      ? "rounded-md bg-red-700 px-5 py-2.5 font-medium text-white hover:bg-red-800 disabled:opacity-50"
      : "rounded-md bg-brand-strong px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50";
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className={`${buttonClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}>
        {pending ? "Working..." : label}
      </button>
      <ResultMessage result={result} />
    </form>
  );
}
