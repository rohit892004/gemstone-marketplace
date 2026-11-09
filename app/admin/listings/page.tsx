import Link from "next/link";
import { Suspense } from "react";
import { DemoBadge } from "@/components/catalogue/badges";
import { formatDate } from "@/components/admin/admin-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";

export const metadata = { title: "Listing review queue", robots: { index: false, follow: false } };

export default function AdminListingQueuePage() {
  return (
    <Suspense fallback={null}>
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await requirePageRole(["ADMIN"]);

  // Oldest submissions first, so nothing waits forever.
  const listings = await prisma.gemstone.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      species: true,
      caratWeight: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      submittedAt: true,
      isDemo: true,
      seller: { select: { businessName: true, city: true, state: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Listing review queue</h1>
        <Link href="/admin/listings/all" className="text-sm underline">
          All listings
        </Link>
      </div>
      <p className="text-sm text-stone-600">
        {listings.length} listing{listings.length === 1 ? "" : "s"} waiting for review, oldest first.
      </p>

      {listings.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          The queue is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-300 bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Seller</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-b border-stone-200 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(listing.submittedAt)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{listing.title}</span>{" "}
                    {listing.isDemo ? <DemoBadge /> : null}
                    <p className="text-xs text-stone-600">
                      {[listing.species, listing.caratWeight ? `${listing.caratWeight.toString()} ct` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {listing.seller.businessName}
                    <p className="text-xs text-stone-600">
                      {listing.seller.city}, {listing.seller.state}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {listing.priceOnRequest ? "On request" : formatMoney(listing.priceMinor, listing.currency) ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/listings/${listing.id}`} className="underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
