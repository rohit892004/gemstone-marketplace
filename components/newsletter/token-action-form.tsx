"use client";

import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
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
      ? "inline-flex min-h-11 items-center justify-center gap-2 bg-danger px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
      : buttonClasses({ variant: "primary", className: "min-h-11" });
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Working..." : label}
      </button>
      <ResultMessage result={result} />
    </form>
  );
}
