/** Buyer tab definitions. Plain module so both server and client code can import it. */
export const BUYER_TABS = [
  { href: "/buyer/wishlist", label: "Wishlist" },
  { href: "/buyer/enquiries", label: "Enquiries" },
  { href: "/buyer/conversations", label: "Conversations" },
  { href: "/buyer/requirements", label: "Requirements" },
  { href: "/buyer/valuations", label: "Valuations" },
  { href: "/buyer/reports", label: "Saved reports" },
] as const;
