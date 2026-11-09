import type { Rendered } from "@/lib/notify/templates";

/** Seller-facing emails for listing and document decisions. Plain text; the caller passes absolute links. */

function greeting(name: string | null): string {
  return `Hello${name ? ` ${name}` : ""},`;
}

export const catalogueTemplates = {
  listingApproved(name: string | null, title: string, url: string): Rendered {
    return {
      subject: `Your listing is live: ${title}`,
      text: `${greeting(name)}\n\nYour listing "${title}" has been reviewed and is now published.\n${url}`,
    };
  },

  listingRejected(name: string | null, title: string, reason: string): Rendered {
    return {
      subject: `Update on your listing: ${title}`,
      text: `${greeting(name)}\n\nWe could not publish your listing "${title}".\n\nReason: ${reason}\n\nYou can edit the listing and submit it again.`,
    };
  },

  documentVerified(name: string | null, documentTitle: string, listingTitle: string): Rendered {
    return {
      subject: `Document verified: ${documentTitle}`,
      text: `${greeting(name)}\n\nThe document "${documentTitle}" on your listing "${listingTitle}" has been verified by our team.\n\nVerification does not make the document public. You choose whether to show it on the listing.`,
    };
  },

  documentRejected(name: string | null, documentTitle: string, listingTitle: string, reason: string): Rendered {
    return {
      subject: `Document not verified: ${documentTitle}`,
      text: `${greeting(name)}\n\nThe document "${documentTitle}" on your listing "${listingTitle}" could not be verified.\n\nReason: ${reason}\n\nYou can upload a corrected document.`,
    };
  },
};
