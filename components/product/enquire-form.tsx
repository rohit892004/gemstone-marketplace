"use client";

import { useState } from "react";
import { startEnquiryAction } from "@/app/gemstones/[slug]/enquire-actions";
import { StartConversationForm } from "@/components/messaging/start-conversation-form";

/**
 * "Chat / Enquire" on the product page. Opens an enquiry tied to this listing. The server resolves
 * the seller from the listing, so the client only sends the gemstone ID and the message.
 */
export function EnquireForm({ gemstoneId, title }: { gemstoneId: string; title: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="w-full rounded-md border border-brand px-4 py-2.5 text-sm font-medium text-brand-strong hover:bg-accent-soft"
        >
          Chat / Enquire
        </button>
        <p className="text-xs text-ink-soft">Ask the seller about this stone. Replies arrive in your conversations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <h3 className="text-sm font-semibold text-ink">Enquire about {title}</h3>
      <StartConversationForm
        intro="Your enquiry opens a conversation with the seller about this stone."
        placeholder="For example: Is this stone still available, and can you share a video?"
        submitLabel="Send enquiry"
        onSubmit={(data) => startEnquiryAction(gemstoneId, data)}
      />
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft hover:text-ink">
        Close
      </button>
    </div>
  );
}
