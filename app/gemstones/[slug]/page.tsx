import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackView } from "@/components/analytics/track";
import { DemoBadge, VerifiedBadge } from "@/components/catalogue/badges";
import { SellerCard } from "@/components/catalogue/seller-card";
import { EnquireForm } from "@/components/product/enquire-form";
import { ProductGallery, type GalleryItem } from "@/components/product/gallery";
import { WishlistButton } from "@/components/product/wishlist-button";
import { PlatformValuations } from "@/components/valuation/platform-valuations";
import { RequestValuationSlot } from "@/components/valuation/request-valuation-slot";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { checkRole } from "@/lib/auth/require-role";
import { MESSAGING_ROLES } from "@/lib/messaging/access";
import { listingDocumentUrl, mediaUrl } from "@/lib/media/urls";
import { formatMoney } from "@/lib/money/money";
import { getPublicGemstoneBySlug } from "@/lib/seller-public/product";
import { showVerifiedBadge, visibleDocuments } from "@/lib/seller-public/visibility";
import { getWishlistViewerState, type WishlistViewerState } from "@/lib/wishlist/queries";

type Props = { params: Promise<{ slug: string }> };

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
};

const eyebrow = "text-[11px] uppercase tracking-[0.25em] text-accent-text";
const textLink =
  "inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicGemstoneBySlug(slug);
  if (!listing) return { title: "Gemstone not found" };

  const cover = listing.media.find((m) => m.type === "IMAGE");
  const specs = [listing.species, listing.caratWeight ? `${listing.caratWeight.toString()} ct` : null]
    .filter(Boolean)
    .join(", ");
  return {
    title: listing.title,
    description: listing.description?.slice(0, 160) ?? `${listing.title}${specs ? `, ${specs}` : ""}. Listed by ${listing.seller.businessName}.`,
    openGraph: cover ? { images: [{ url: mediaUrl(cover.id, "full"), alt: cover.alt ?? listing.title }] } : undefined,
  };
}

export default function GemstonePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <GemstoneDetail params={params} />
    </Suspense>
  );
}

async function GemstoneDetail({ params }: Props) {
  const { slug } = await params;
  const listing = await getPublicGemstoneBySlug(slug);
  if (!listing) notFound();

  const documents = visibleDocuments(listing.documents);
  const verified = showVerifiedBadge(listing.documents);
  const wishlist: WishlistViewerState = await getWishlistViewerState(listing.id, listing.seller.userId);

  const gallery: GalleryItem[] = listing.media.map((m) => ({ id: m.id, type: m.type, alt: m.alt }));
  const price = listing.priceOnRequest
    ? "Price on request"
    : (formatMoney(listing.priceMinor, listing.currency) ?? "Price on request");

  const specRows: [string, string | null][] = [
    ["Gemstone type", listing.species],
    ["Variety", listing.variety],
    ["Carat weight", listing.caratWeight ? `${listing.caratWeight.toString()} ct` : null],
    ["Dimensions", listing.dimensions],
    ["Colour", listing.colour],
    ["Clarity", listing.clarity],
    ["Cut", listing.cut],
    ["Shape", listing.shape],
    ["Origin", listing.origin],
    ["Treatment", listing.treatment],
    ["Certificate lab", listing.certificateLab?.name ?? null],
    ["Certificate number", listing.certificateNo],
    ["Quantity", String(listing.quantity)],
  ];

  const sellerCard = {
    slug: listing.seller.slug,
    businessName: listing.seller.businessName,
    city: listing.seller.city,
    state: listing.seller.state,
    country: listing.seller.country,
    specialties: listing.seller.specialties,
    ratingAverage: listing.seller.ratingAverage ? listing.seller.ratingAverage.toString() : null,
    reviewCount: listing.seller.reviewCount,
    isDemo: listing.seller.isDemo,
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <TrackView kind="LISTING_VIEW" gemstoneId={listing.id} />
      <nav aria-label="Breadcrumb" className="mb-8 text-[12px] uppercase tracking-[0.18em] text-ink-soft">
        <Link href="/gemstones" className="hover:text-accent-text">
          Gemstones
        </Link>{" "}
        / <span className="normal-case tracking-normal text-ink">{listing.title}</span>
      </nav>

      <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        <ProductGallery items={gallery} title={listing.title} />

        <div className="space-y-10 lg:sticky lg:top-10 lg:self-start">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {verified ? <VerifiedBadge /> : null}
              {listing.isDemo ? <DemoBadge /> : null}
              <Badge>{AVAILABILITY_LABEL[listing.availability] ?? "Unavailable"}</Badge>
            </div>
            <h1 className="font-heading text-4xl leading-tight text-ink sm:text-5xl">{listing.title}</h1>
            <p className="text-2xl text-ink">{price}</p>
          </header>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/sellers/${listing.seller.slug}`} variant="secondary" block>
                View seller portfolio
              </ButtonLink>
              <WishlistSlot state={wishlist} listingId={listing.id} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Suspense fallback={null}>
                <RequestValuationSlot gemstoneId={listing.id} slug={listing.slug} />
              </Suspense>
              <EnquireSlot slug={listing.slug} listingId={listing.id} title={listing.title} sellerUserId={listing.seller.userId} />
            </div>
          </div>

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className={eyebrow}>
              Specifications
            </h2>
            <dl className="mt-4 divide-y divide-line border-y border-line text-[14px]">
              {specRows
                .filter((row): row is [string, string] => !!row[1])
                .map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[9rem_1fr] gap-4 py-3">
                    <dt className="text-ink-soft">{label}</dt>
                    <dd className="text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <Suspense fallback={null}>
            <PlatformValuations gemstoneId={listing.id} />
          </Suspense>

          {listing.description ? (
            <section aria-labelledby="desc-heading">
              <h2 id="desc-heading" className={eyebrow}>
                Description
              </h2>
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{listing.description}</p>
            </section>
          ) : null}

          <section aria-labelledby="docs-heading">
            <h2 id="docs-heading" className={eyebrow}>
              Certificates and documents
            </h2>
            {documents.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-soft">No verified documents are published for this stone yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-[14px]">
                    <div className="space-y-2">
                      <p className="text-ink">{doc.title}</p>
                      <p className="text-[13px] text-ink-soft">
                        {doc.certificateLab?.name ?? "Document"} · {doc.fileName}
                      </p>
                      <VerifiedBadge />
                    </div>
                    <a href={listingDocumentUrl(doc.id)} download className={textLink}>
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="seller-heading" className="space-y-4">
            <h2 id="seller-heading" className={eyebrow}>
              Seller
            </h2>
            <SellerCard seller={sellerCard} />
          </section>
        </div>
      </div>
    </section>
  );
}

function WishlistSlot({ state, listingId }: { state: WishlistViewerState; listingId: string }) {
  switch (state.kind) {
    case "ready":
      return <WishlistButton listingId={listingId} initialSaved={state.saved} />;
    case "owner":
      return (
        <div className="space-y-2">
          <button type="button" disabled className={buttonClasses({ variant: "secondary", block: true })}>
            Save to wishlist
          </button>
          <p className="text-[12px] text-ink-soft">This is your listing, so you cannot save it.</p>
        </div>
      );
    case "signed-out":
      return (
        <div className="space-y-2">
          <ButtonLink href="/login" variant="secondary" block>
            Sign in to save
          </ButtonLink>
          <p className="text-[12px] text-ink-soft">Sign in as a buyer to keep a wishlist.</p>
        </div>
      );
    case "unavailable":
      return <p className="self-center text-[12px] text-ink-soft">Wishlist is available to buyer and seller accounts.</p>;
  }
}

/** Chat / Enquire: approved buyers and sellers (not the listing's own seller) get the enquiry form. */
async function EnquireSlot({
  slug,
  listingId,
  title,
  sellerUserId,
}: {
  slug: string;
  listingId: string;
  title: string;
  sellerUserId: string;
}) {
  const viewer = await checkRole(MESSAGING_ROLES, { sellerApproved: true });
  if (!viewer.ok) {
    if (viewer.code === "UNAUTHENTICATED") {
      return (
        <div className="space-y-2">
          <ButtonLink href={`/login?next=${encodeURIComponent(`/gemstones/${slug}`)}`} variant="secondary" block>
            Sign in to enquire
          </ButtonLink>
          <p className="text-[12px] text-ink-soft">Sign in as a buyer to chat with the seller.</p>
        </div>
      );
    }
    return <p className="self-center text-[12px] text-ink-soft">Enquiries are available to approved buyer and seller accounts.</p>;
  }
  if (viewer.user.id === sellerUserId) {
    return <p className="self-center text-[12px] text-ink-soft">This is your listing, so you cannot enquire about it.</p>;
  }
  return <EnquireForm gemstoneId={listingId} title={title} />;
}
