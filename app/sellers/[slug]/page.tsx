import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoBadge } from "@/components/catalogue/badges";
import { ListingCard } from "@/components/catalogue/listing-card";
import { Rating } from "@/components/catalogue/rating";
import { VerifiedSellerBadge } from "@/components/catalogue/verified-seller-badge";
import { getApprovedReviews, getPublicSellerBySlug, listSellerGemstones } from "@/lib/seller-public/queries";

/**
 * Public seller portfolio. Shows only public profile fields, APPROVED reviews and the seller's
 * public gemstones. Logos and banners are not shown: they live in private storage and no public
 * image route exists yet, so the portfolio uses an initial-letter avatar and a plain banner.
 */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getPublicSellerBySlug(slug);
  if (!seller) return { title: "Seller not found" };
  return {
    title: seller.businessName,
    description: seller.tagline ?? `${seller.businessName}, gemstone seller in ${seller.city}, ${seller.state}.`,
  };
}

export default function SellerPortfolioPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <SellerPortfolio params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SellerPortfolio({ params, searchParams }: Props) {
  const { slug } = await params;
  const seller = await getPublicSellerBySlug(slug);
  if (!seller) notFound();

  const raw = (await searchParams).page;
  const pageNum = Number.parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 && pageNum <= 1000 ? pageNum : 1;

  const [reviews, gemstones] = await Promise.all([
    getApprovedReviews(seller.id),
    listSellerGemstones(seller.id, page),
  ]);
  const totalPages = Math.max(1, Math.ceil(gemstones.total / gemstones.pageSize));
  const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

  return (
    <>
      <div className="h-40 bg-gradient-to-r from-accent-soft to-surface-raised sm:h-52" aria-hidden="true" />
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-brand text-3xl font-semibold text-white"
          >
            {seller.businessName.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-2 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{seller.businessName}</h1>
              <VerifiedSellerBadge />
              {seller.isDemo ? <DemoBadge /> : null}
            </div>
            {seller.tagline ? <p className="text-ink-soft">{seller.tagline}</p> : null}
            <p className="text-sm text-ink-soft">
              {[seller.city, seller.state, seller.country].filter(Boolean).join(", ")}
              {seller.yearsInBusiness ? ` · ${seller.yearsInBusiness} years in business` : ""}
            </p>
            <Rating average={seller.ratingAverage} count={seller.reviewCount} isDemo={seller.isDemo} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-lg font-semibold text-ink">
                About
              </h2>
              <p className="mt-2 whitespace-pre-line text-ink-soft">
                {seller.description ?? "This seller has not written a description yet."}
              </p>
            </section>

            <section aria-labelledby="stones-heading">
              <h2 id="stones-heading" className="text-lg font-semibold text-ink">
                Gemstones ({gemstones.total})
              </h2>
              {gemstones.items.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">No stones are listed right now.</p>
              ) : (
                <>
                  <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {gemstones.items.map((item, i) => (
                      <li key={item.id}>
                        <ListingCard listing={item} priority={i < 2} />
                      </li>
                    ))}
                  </ul>
                  <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
                    {page > 1 ? (
                      <Link href={`/sellers/${seller.slug}?page=${page - 1}`} rel="prev" className="rounded-md border border-line px-3 py-1.5">
                        Previous
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-ink-soft">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link href={`/sellers/${seller.slug}?page=${page + 1}`} rel="next" className="rounded-md border border-line px-3 py-1.5">
                        Next
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section aria-labelledby="specialties-heading" className="rounded-lg border border-line bg-surface-raised p-5">
              <h2 id="specialties-heading" className="text-base font-semibold text-ink">
                Specialties
              </h2>
              {seller.specialties.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {seller.specialties.map((s) => (
                    <li key={s} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Not specified.</p>
              )}
            </section>

            <section aria-labelledby="reviews-heading" className="rounded-lg border border-line bg-surface-raised p-5">
              <h2 id="reviews-heading" className="text-base font-semibold text-ink">
                Reviews
              </h2>
              {reviews.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">No reviews yet.</p>
              ) : (
                <ul className="mt-3 space-y-5">
                  {reviews.map((review) => (
                    <li key={review.id} className="space-y-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2 text-ink">
                        <span className="font-medium">{review.authorName}</span>
                        <span aria-label={`${review.rating} out of 5 stars`} className="text-accent">
                          {"★".repeat(review.rating)}
                        </span>
                        {review.isDemo ? <DemoBadge /> : null}
                      </p>
                      <p className="text-xs text-ink-soft">{dateFormat.format(review.createdAt)}</p>
                      {review.title ? <p className="font-medium text-ink">{review.title}</p> : null}
                      <p className="whitespace-pre-line text-ink-soft">{review.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
