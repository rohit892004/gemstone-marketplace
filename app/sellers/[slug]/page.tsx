import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DemoBadge } from "@/components/catalogue/badges";
import { ListingCard } from "@/components/catalogue/listing-card";
import { Rating } from "@/components/catalogue/rating";
import { VerifiedSellerBadge } from "@/components/catalogue/verified-seller-badge";
import { ContactSellerForm } from "@/components/seller/contact-seller-form";
import { checkRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { MESSAGING_ROLES } from "@/lib/messaging/access";
import { getApprovedReviews, getPublicSellerBySlug, listSellerGemstones } from "@/lib/seller-public/queries";

/**
 * Public seller portfolio. Shows only public profile fields, APPROVED reviews and the seller's
 * public gemstones. Logo and banner images come from /api/sellers/[slug]/assets/[kind], which
 * serves them only for APPROVED sellers. A plain initial avatar and gradient show when none exist.
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
      <div className="relative h-40 bg-gradient-to-r from-accent-soft to-surface-raised sm:h-52" aria-hidden="true">
        {seller.hasBanner ? (
          <Image
            src={`/api/sellers/${encodeURIComponent(seller.slug)}/assets/banner`}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
          {seller.hasLogo ? (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-surface bg-surface-raised">
              <Image
                src={`/api/sellers/${encodeURIComponent(seller.slug)}/assets/logo`}
                alt={`${seller.businessName} logo`}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-brand text-3xl font-semibold text-white"
            >
              {seller.businessName.charAt(0).toUpperCase()}
            </div>
          )}
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
            <ContactSection slug={seller.slug} businessName={seller.businessName} sellerId={seller.id} />

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

/**
 * Contact the seller inside the platform. Approved buyers and sellers can start a general conversation.
 * The seller is resolved by slug on the server, and the seller's own account sees a note instead.
 */
async function ContactSection({ slug, businessName, sellerId }: { slug: string; businessName: string; sellerId: string }) {
  const viewer = await checkRole(MESSAGING_ROLES, { sellerApproved: true });
  let content: ReactNode;
  if (!viewer.ok) {
    content =
      viewer.code === "UNAUTHENTICATED" ? (
        <div className="space-y-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/sellers/${slug}`)}`}
            className="block w-full rounded-md border border-brand px-4 py-2.5 text-center text-sm font-medium text-brand-strong hover:bg-accent-soft"
          >
            Sign in to contact
          </Link>
          <p className="text-xs text-ink-soft">Sign in as a buyer to message this seller on the platform.</p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Messaging is available to approved buyer and seller accounts.</p>
      );
  } else {
    const owner = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true } });
    content =
      owner?.userId === viewer.user.id ? (
        <p className="text-sm text-ink-soft">This is your business profile.</p>
      ) : (
        <ContactSellerForm sellerSlug={slug} businessName={businessName} />
      );
  }

  return (
    <section aria-labelledby="contact-heading" className="rounded-lg border border-line bg-surface-raised p-5">
      <h2 id="contact-heading" className="text-base font-semibold text-ink">
        Contact seller
      </h2>
      <div className="mt-3">{content}</div>
    </section>
  );
}

