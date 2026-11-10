import { Suspense } from "react";
import { MessageSquareQuote } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Queue"
        title="Review moderation"
        lead={
          <>
            Only approved reviews count toward a seller&apos;s rating. Approving or rejecting recalculates that rating. {reviews.length} pending, oldest
            first.
          </>
        }
      />

      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No reviews are waiting for moderation"
          body="Buyer reviews appear here before they count toward a seller's rating."
        />
      ) : (
        <ul className="space-y-6">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card className="space-y-5 p-5 text-sm sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-xl text-ink">{review.seller.businessName}</span>
                  {review.isDemo ? <AdminDemoTag /> : null}
                  <span className="text-ink-soft">
                    {review.rating}/5 by {review.authorName} · {formatDate(review.createdAt)}
                  </span>
                </div>
                {review.title ? <p className="font-medium text-ink">{review.title}</p> : null}
                <p className="whitespace-pre-line leading-relaxed text-ink">{review.body}</p>
                <div className="grid gap-6 md:grid-cols-2">
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
                    description="The review is hidden and not counted. Record why it was rejected."
                    submitLabel="Reject review"
                    tone="danger"
                    fields={[
                      { name: "reason", label: "Reason (at least 10 characters)", kind: "textarea", required: true, maxLength: 1000 },
                    ]}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
