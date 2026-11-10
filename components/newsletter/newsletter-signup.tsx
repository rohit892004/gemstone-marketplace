"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { CONSENT_TEXT, SIGNUP_ACCEPTED_MESSAGE } from "@/lib/newsletter/messages";
import { TopicFieldset } from "./topic-fieldset";

type SignupState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  no_topic: "Choose at least one topic.",
  rate_limited: "Too many sign-up attempts from this network. Try again later.",
};

/**
 * Newsletter sign-up. Posts to /api/newsletter/subscribe. No topic is pre-ticked, and the consent text says
 * what the reader agrees to. Every accepted request shows the same message, whatever the address.
 */
export function NewsletterSignup({ source, variant = "page" }: { source: string; variant?: "page" | "inline" }) {
  const id = useId();
  const [state, setState] = useState<SignupState>({ kind: "idle" });
  const inline = variant === "inline";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const topics = data.getAll("topics").map(String);
    if (topics.length === 0) {
      setState({ kind: "error", message: ERROR_MESSAGES.no_topic });
      return;
    }
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, topics, source, scope: "SELECTED_TOPICS" }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (response.status === 202) {
        setState({ kind: "done", message: body.message ?? SIGNUP_ACCEPTED_MESSAGE });
        form.reset();
        return;
      }
      if (response.status === 422 || response.status === 429) {
        setState({ kind: "error", message: ERROR_MESSAGES[body.error ?? ""] ?? "Check the form and try again." });
        return;
      }
      setState({ kind: "error", message: "Something went wrong. Please try again in a few minutes." });
    } catch {
      setState({ kind: "error", message: "We could not reach the server. Check your connection and try again." });
    }
  }

  const sending = state.kind === "sending";
  return (
    <div className={inline ? "space-y-5" : "space-y-6"}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate={false}>
        <Field id={`${id}-email`} label="Email address">
          <Input id={`${id}-email`} name="email" type="email" required autoComplete="email" maxLength={254} />
        </Field>

        <TopicFieldset layout="list" legend="Topics (choose at least one)" idPrefix={`${id}-topic`} />

        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            required
            name="consent"
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-strong focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <span>{CONSENT_TEXT}</span>
        </label>

        <Button type="submit" block disabled={sending} className="min-h-11">
          {sending ? "Sending..." : "Sign up"}
        </Button>
      </form>

      <div role="status" aria-live="polite" className={state.kind === "error" ? "text-sm text-danger" : "text-sm text-ink"}>
        {state.kind === "done" || state.kind === "error" ? state.message : null}
      </div>
    </div>
  );
}
