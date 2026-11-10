import type { Metadata } from "next";
import { TrackView } from "@/components/analytics/track";
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
import { FollowButton } from "@/components/membership/follow-button";
import { TierBadge } from "@/components/membership/tier-badge";
import { loadTierRules } from "@/lib/membership/service";
import { ruleFor, type Tier } from "@/lib/membership/tiers";
import { ButtonLink } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Public seller portfolio. Shows only public profile fields, APPROVED reviews and the seller's
 * public gemstones. Logo and banner images come from /api/sellers/[slug]/assets/[kind], which
 * serves them only for APPROVED sellers. A plain initial avatar and panel show when none exist.
 */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string | string[] }> };

const eyebrow = "text-[11px] uppercase tracking-[0.25em] text-accent-text";
const panel = "border border-line bg-surface-raised p-6 shadow-soft";
const pageLink =
  "inline-flex min-h-11 items-center border border-line px-5 text-[13px] tracking-wide text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

  const [reviews, gemstones, followerCount, membership, rules] = await Promise.all([
    getApprovedReviews(seller.id),
    listSellerGemstones(seller.id, page),
    prisma.follow.count({ where: { sellerId: seller.id } }),
    prisma.sellerMembership.findUnique({ where: { sellerId: seller.id }, select: { tier: true } }),
    loadTierRules(),
  ]);
  const tier: Tier = membership?.tier ?? "FREE";
  const tierRule = ruleFor(rules, tier);
  const totalPages = Math.max(1, Math.ceil(gemstones.total / gemstones.pageSize));
  const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

  return (
    <>
      <TrackView kind="PROFILE_VIEW" sellerSlug={slug} />
      <Photo
        src={seller.hasBanner ? `/api/sellers/${encodeURIComponent(seller.slug)}/assets/banner` : ""}
        alt=""
        ratio="h-44 sm:h-64"
        sizes="100vw"
        priority
        zoomOnHover={false}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="-mt-14 flex flex-col gap-6 sm:flex-row sm:items-end">
          {seller.hasLogo ? (
            <Photo
              src={`/api/sellers/${encodeURIComponent(seller.slug)}/assets/logo`}
              alt={`${seller.businessName} logo`}
              ratio="size-28 rounded-full"
              className="size-28 shrink-0 border-4 border-surface"
              zoomOnHover={false}
              sizes="112px"
            />
          ) : (
            <div
              aria-hidden="true"
              className="grid size-28 shrink-0 place-items-center rounded-full border-4 border-surface bg-brand font-heading text-4xl text-ivory"
            >
              {seller.businessName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="space-y-3 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-4xl leading-tight text-ink sm:text-5xl">{seller.businessName}</h1>
              <VerifiedSellerBadge />
              {seller.isDemo ? <DemoBadge /> : null}
              <TierBadge tier={tier} hasBadge={tierRule.hasBadge} />
            </div>
            <p className="text-[13px] text-ink-soft">
              {followerCount} {followerCount === 1 ? "follower" : "followers"}
            </p>
            {seller.tagline ? <p className="text-[15px] text-ink-soft">{seller.tagline}</p> : null}
            <p className="text-[13px] text-ink-soft">
              {[seller.city, seller.state, seller.country].filter(Boolean).join(", ")}
              {seller.yearsInBusiness ? ` · ${seller.yearsInBusiness} years in business` : ""}
            </p>
            <Rating average={seller.ratingAverage} count={seller.reviewCount} isDemo={seller.isDemo} />
          </div>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0 space-y-14">
            <section aria-labelledby="about-heading" className="space-y-4">
              <h2 id="about-heading" className={eyebrow}>
                About
              </h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
                {seller.description ?? "This seller has not written a description yet."}
              </p>
            </section>

            <section aria-labelledby="stones-heading" className="space-y-8">
              <h2 id="stones-heading" className="font-heading text-3xl text-ink">
                Gemstones ({gemstones.total})
              </h2>
              {gemstones.items.length === 0 ? (
                <EmptyState title="No stones are listed right now" body="Check back soon, or follow this seller to hear about new listings." />
              ) : (
                <>
                  <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2">
                    {gemstones.items.map((item, i) => (
                      <li key={item.id}>
                        <ListingCard listing={item} priority={i < 2} />
                      </li>
                    ))}
                  </ul>
                  <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
                    {page > 1 ? (
                      <Link href={`/sellers/${seller.slug}?page=${page - 1}`} rel="prev" className={pageLink}>
                        Previous
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-[13px] text-ink-soft">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link href={`/sellers/${seller.slug}?page=${page + 1}`} rel="next" className={pageLink}>
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

          <aside className="min-w-0 space-y-6">
            <FollowSection slug={seller.slug} sellerId={seller.id} />
            <ContactSection slug={seller.slug} businessName={seller.businessName} sellerId={seller.id} />

            <section aria-labelledby="specialties-heading" className={panel}>
              <h2 id="specialties-heading" className={eyebrow}>
                Specialties
              </h2>
              {seller.specialties.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {seller.specialties.map((s) => (
                    <li key={s} className="border border-line px-3 py-1.5 text-[13px] text-ink-soft">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-ink-soft">Not specified.</p>
              )}
            </section>

            <section aria-labelledby="reviews-heading" className={panel}>
              <h2 id="reviews-heading" className={eyebrow}>
                Reviews
              </h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-[14px] text-ink-soft">No reviews yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {reviews.map((review) => (
                    <li key={review.id} className="space-y-2 py-5 text-[14px] first:pt-0 last:pb-0">
                      <p className="flex flex-wrap items-center gap-2 text-ink">
                        <span className="font-medium">{review.authorName}</span>
                        <span role="img" aria-label={`${review.rating} out of 5 stars`} className="text-accent-text">
                          {"★".repeat(review.rating)}
                        </span>
                        {review.isDemo ? <DemoBadge /> : null}
                      </p>
                      <p className="text-[12px] text-ink-soft">{dateFormat.format(review.createdAt)}</p>
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
 * Follow the seller. Buyers and sellers can follow an approved seller and get told about new listings. Signed-out
 * visitors get a sign-in link that comes back here. A seller's own profile gets a note instead.
 */
async function FollowSection({ slug, sellerId }: { slug: string; sellerId: string }) {
  const viewer = await checkRole(["BUYER", "SELLER"]);
  let content: ReactNode;
  if (!viewer.ok) {
    content =
      viewer.code === "UNAUTHENTICATED" || viewer.code === "EMAIL_NOT_VERIFIED" ? (
        <ButtonLink href={`/login?next=${encodeURIComponent(`/sellers/${slug}`)}`} variant="secondary" block>
          Sign in to follow
        </ButtonLink>
      ) : (
        <p className="text-[14px] text-ink-soft">Following is available to buyer and seller accounts.</p>
      );
  } else {
    const [owner, follow] = await Promise.all([
      prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true } }),
      prisma.follow.findUnique({
        where: { followerId_sellerId: { followerId: viewer.user.id, sellerId } },
        select: { id: true },
      }),
    ]);
    content =
      owner?.userId === viewer.user.id ? (
        <p className="text-[14px] text-ink-soft">This is your business profile.</p>
      ) : (
        <FollowButton sellerSlug={slug} following={Boolean(follow)} />
      );
  }
  return (
    <section aria-labelledby="follow-heading" className="border border-line bg-surface-raised p-6 shadow-soft">
      <h2 id="follow-heading" className={eyebrow}>
        Follow
      </h2>
      <p className="mt-3 text-[14px] text-ink-soft">Get an alert when this seller publishes a new listing.</p>
      <div className="mt-4">{content}</div>
    </section>
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
        <div className="space-y-3">
          <ButtonLink href={`/login?next=${encodeURIComponent(`/sellers/${slug}`)}`} variant="secondary" block>
            Sign in to contact
          </ButtonLink>
          <p className="text-[12px] text-ink-soft">Sign in as a buyer to message this seller on the platform.</p>
        </div>
      ) : (
        <p className="text-[14px] text-ink-soft">Messaging is available to approved buyer and seller accounts.</p>
      );
  } else {
    const owner = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true } });
    content =
      owner?.userId === viewer.user.id ? (
        <p className="text-[14px] text-ink-soft">This is your business profile.</p>
      ) : (
        <ContactSellerForm sellerSlug={slug} businessName={businessName} />
      );
  }

  return (
    <section aria-labelledby="contact-heading" className="border border-line bg-surface-raised p-6 shadow-soft">
      <h2 id="contact-heading" className={eyebrow}>
        Contact seller
      </h2>
      <div className="mt-4">{content}</div>
    </section>
  );
}
