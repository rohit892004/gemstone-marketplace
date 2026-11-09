"use client";

import { contactSellerAction } from "@/app/sellers/[slug]/contact-actions";
import { StartConversationForm } from "@/components/messaging/start-conversation-form";

/** Contact form on a seller's portfolio page. Opens a general conversation with the seller. */
export function ContactSellerForm({ sellerSlug, businessName }: { sellerSlug: string; businessName: string }) {
  return (
    <StartConversationForm
      intro={`Ask ${businessName} about stock, pricing or a custom order.`}
      placeholder="Introduce yourself and say what you are looking for."
      submitLabel="Send message"
      onSubmit={(data) => contactSellerAction(sellerSlug, data)}
    />
  );
}
