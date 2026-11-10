"use client";

import { useState } from "react";
import { startEnquiryAction } from "@/app/gemstones/[slug]/enquire-actions";
import { StartConversationForm } from "@/components/messaging/start-conversation-form";
import { buttonClasses } from "@/components/ui/button";

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
          className={buttonClasses({ variant: "secondary", block: true })}
        >
          Chat / Enquire
        </button>
        <p className="text-[12px] text-ink-soft">Ask the seller about this stone. Replies arrive in your conversations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <h3 className="font-heading text-xl text-ink">Enquire about {title}</h3>
      <StartConversationForm
        intro="Your enquiry opens a conversation with the seller about this stone."
        placeholder="For example: Is this stone still available, and can you share a video?"
        submitLabel="Send enquiry"
        onSubmit={(data) => startEnquiryAction(gemstoneId, data)}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex min-h-11 items-center text-[13px] text-ink-soft underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Close
      </button>
    </div>
  );
}
