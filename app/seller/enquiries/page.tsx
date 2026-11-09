import { redirect } from "next/navigation";

/** Enquiries now live in the seller inbox, filtered to enquiries. */
export default function SellerEnquiriesPage() {
  redirect("/seller/inbox?kind=enquiry");
}
