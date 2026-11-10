"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { respondToRequirementAction } from "@/app/seller/requirements/actions";

/**
 * Seller's first response to a requirement. Sends through the shared messaging service, so contact details
 * are masked and the rate limit applies. On success the seller is taken to the new conversation.
 */
export function RequirementRespondForm({ requirementId }: { requirementId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingConversation, setExistingConversation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("body", body);
    startTransition(async () => {
      const result = await respondToRequirementAction(requirementId, form);
      if (!result.ok) {
        setError(result.error);
        setExistingConversation(result.conversationId ?? null);
        return;
      }
      router.push(`/conversations/${result.conversationId}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border border-line bg-surface-raised p-4">
      <h2 className="text-base font-semibold text-ink">Respond to this requirement</h2>
      <label htmlFor="requirement-response" className="text-sm text-ink-soft">
        Your opening message
      </label>
      <textarea
        id="requirement-response"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={5}
        maxLength={2000}
        placeholder="Introduce your stock and what you can offer. Phone numbers, emails and social handles are hidden automatically."
        className="w-full border border-line bg-surface px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className=" bg-brand px-4 py-2 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send response"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
          {existingConversation && (
            <>
              {" "}
              <Link href={`/conversations/${existingConversation}`} className="font-medium underline">
                Open conversation
              </Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}
