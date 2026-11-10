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
      ? "inline-flex min-h-11 items-center justify-center bg-danger px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-danger/90 disabled:opacity-50"
      : "inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
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
