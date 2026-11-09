import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { approveReview, rejectReview } from "./actions";

export const metadata = { title: "Review moderation", robots: { index: false, follow: false } };

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={null}>
      <ReviewQueue />
    </Suspense>
  );
}

async function ReviewQueue() {
  await requirePageRole(["ADMIN"]);

  const reviews = await prisma.review.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      authorName: true,
      rating: true,
      title: true,
      body: true,
      isDemo: true,
      createdAt: true,
      seller: { select: { businessName: true, ratingAverage: true, reviewCount: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Review moderation</h1>
      <p className="text-sm text-stone-600">
        Only approved reviews count toward a seller&apos;s rating. Approving or rejecting recalculates that rating.
        {reviews.length} pending, oldest first.
      </p>

      {reviews.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No reviews are waiting for moderation.</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-3 rounded border border-stone-300 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{review.seller.businessName}</span>
                {review.isDemo ? <DemoBadge /> : null}
                <span className="text-stone-600">
                  {review.rating}/5 by {review.authorName} · {formatDate(review.createdAt)}
                </span>
              </div>
              {review.title ? <p className="font-medium">{review.title}</p> : null}
              <p className="whitespace-pre-line">{review.body}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <ActionForm
                  action={approveReview}
                  hidden={{ reviewId: review.id }}
                  title="Approve"
                  description="The review is published and counted in the seller's rating."
                  submitLabel="Approve review"
                />
                <ActionForm
                  action={rejectReview}
                  hidden={{ reviewId: review.id }}
                  title="Reject"
                  description="The review is hidden and not counted."
                  submitLabel="Reject review"
                  tone="danger"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
