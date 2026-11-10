"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FOOTER_CONSENT_TEXT, SIGNUP_ACCEPTED_MESSAGE } from "@/lib/newsletter/messages";

type FooterSignupState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * Compact newsletter sign-up for the dark site footer: one email field and a Subscribe button on a row, with
 * the consent line beneath. Subscribe is consent to all topics; the server stores FOOTER_CONSENT_TEXT with it.
 * There are no topic boxes and nothing is pre-ticked.
 */
export function FooterSignup() {
  const id = useId();
  const [state, setState] = useState<FooterSignupState>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "footer", scope: "ALL_TOPICS" }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (response.status === 202) {
        setState({ kind: "done", message: body.message ?? SIGNUP_ACCEPTED_MESSAGE });
        form.reset();
        return;
      }
      if (response.status === 422) {
        setState({ kind: "error", message: "Enter a valid email address." });
        return;
      }
      if (response.status === 429) {
        setState({ kind: "error", message: "Too many sign-up attempts from this network. Try again later." });
        return;
      }
      setState({ kind: "error", message: "Something went wrong. Please try again in a few minutes." });
    } catch {
      setState({ kind: "error", message: "We could not reach the server. Check your connection and try again." });
    }
  }

  const sending = state.kind === "sending";
  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" aria-describedby={`${id}-consent`}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          className="min-h-11 min-w-0 flex-1 border border-ivory/40 bg-transparent px-3 text-sm text-ivory focus:border-champagne focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
        />
        <Button type="submit" variant="gold" disabled={sending} className="min-h-11 shrink-0">
          {sending ? "Subscribing..." : "Subscribe"}
        </Button>
      </form>

      <p id={`${id}-consent`} className="text-xs leading-relaxed text-ivory/70">
        {FOOTER_CONSENT_TEXT}
      </p>

      <div role="status" aria-live="polite" className={state.kind === "error" ? "text-sm font-medium text-champagne" : "text-sm text-ivory"}>
        {state.kind === "done" || state.kind === "error" ? state.message : null}
      </div>
    </div>
  );
}
