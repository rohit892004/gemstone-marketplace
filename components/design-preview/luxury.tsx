"use client";

import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Heart, Maximize2, ShieldCheck, X, Mail, MapPin, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LUXURY_PHOTOS } from "./luxury-images";

/**
 * Luxury direction. Real photographs only, a restrained palette, serif headings, sans-serif body, thin rules.
 * Demo data. Every "Demo" tag is small and quiet. Motion is slow: fades and a gentle image zoom.
 */

const STONES: { name: string; spec: string; price: string; verified: boolean; photo: string }[] = [
  { name: "Cornflower sapphire", spec: "3.39 ct · round · Sri Lanka", price: "₹1,52,550", verified: true, photo: LUXURY_PHOTOS.stones[2] },
  { name: "Pigeon blood ruby", spec: "1.17 ct · cushion · Mozambique", price: "₹70,200", verified: true, photo: LUXURY_PHOTOS.stones[0] },
  { name: "Vivid green emerald", spec: "1.54 ct · round · Colombia", price: "₹80,080", verified: false, photo: LUXURY_PHOTOS.stones[1] },
  { name: "Brilliant diamond", spec: "2.65 ct · round · Botswana", price: "₹3,18,000", verified: true, photo: LUXURY_PHOTOS.stones[3] },
  { name: "Violet amethyst", spec: "2.10 ct · cluster · Brazil", price: "₹12,400", verified: false, photo: LUXURY_PHOTOS.stones[4] },
  { name: "Fire opal", spec: "1.80 ct · cabochon · Australia", price: "On request", verified: true, photo: LUXURY_PHOTOS.stones[5] },
];

const SELLERS = [
  { name: "Himalaya Gem House", place: "Jaipur, Rajasthan", specs: "Sapphire · Ruby" },
  { name: "Deccan Stone Works", place: "Hyderabad, Telangana", specs: "Emerald · Tourmaline" },
  { name: "Coastal Gem Exchange", place: "Mumbai, Maharashtra", specs: "Diamond · Spinel" },
  { name: "Malabar Precious Gems", place: "Kochi, Kerala", specs: "Diamond · Emerald" },
];

const CATEGORIES = [
  { key: "diamond", label: "Diamond" },
  { key: "emerald", label: "Emerald" },
  { key: "ruby", label: "Ruby" },
  { key: "sapphire", label: "Sapphire" },
  { key: "amethyst", label: "Amethyst" },
  { key: "opal", label: "Opal" },
] as const;

/** A photo, or a plain charcoal panel when the file is not there yet. Never an illustration. */
function Photo({ src, alt, className = "", zoomOnHover = true }: { src: string; alt: string; className?: string; zoomOnHover?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div role="img" aria-label={alt} className={`bg-[#1a1917] ${className}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static preview assets served from /public
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover transition-transform duration-[1400ms] ease-out ${zoomOnHover ? "group-hover:scale-[1.04]" : ""} ${className}`}
    />
  );
}

function Demo() {
  return <span className="text-[10px] uppercase tracking-[0.22em] text-[#8a8478]">Demo</span>;
}

function Fade({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      // Never fully hidden: content starts almost opaque and settles in, so nothing is blank before it is scrolled to.
      initial={reduce ? false : { opacity: 0.85 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Rule() {
  return <div className="h-px w-full bg-[#e3ddd2]" aria-hidden />;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a6d43]">{eyebrow}</p>
        <h2 className="mt-3 font-[family-name:var(--font-lux-serif)] text-4xl font-medium leading-tight text-[#1c1a17] sm:text-5xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0e0d0b] text-[#f4f0e8]">
      <div className="absolute inset-0">
        <Photo src={LUXURY_PHOTOS.hero} alt="Close-up of a gemstone against a dark background" className="absolute inset-0" zoomOnHover={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" aria-hidden />
      <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-6 pb-16 pt-32 sm:px-10">
        <Fade>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#d8c39b]">Verified gemstones from India</p>
          <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-lux-serif)] text-5xl font-medium leading-[1.05] sm:text-7xl">
            Rare stones, <span className="italic text-[#e6d3a8]">chosen with care</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#cfc7b8]">
            Browse certified and verified stones from independent sellers, speak to them directly on the platform, and request an indicative valuation.
          </p>
        </Fade>
        <form className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
          <label className="flex-1">
            <span className="sr-only">Search gemstones</span>
            <input
              className="h-13 w-full border border-white/25 bg-black/30 px-5 py-4 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#d8c39b]"
              placeholder="Search by stone, origin or seller"
            />
          </label>
          <button type="submit" className="bg-[#f4f0e8] px-8 py-4 text-sm font-medium tracking-wide text-[#1c1a17] transition hover:bg-[#e6d3a8]">
            Search
          </button>
        </form>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.18em] text-[#bdb4a3]">
          {["Diamond", "Emerald", "Ruby", "Sapphire", "Amethyst", "Opal"].map((c) => (
            <a key={c} href="#categories" className="hover:text-[#e6d3a8]">
              {c}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const [ref, api] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });
  return (
    <div>
      <div className="mb-6 flex justify-end gap-2">
        <button type="button" aria-label={`Previous ${label}`} onClick={() => api?.scrollPrev()} className="grid h-10 w-10 place-items-center border border-[#d9d2c4] text-[#1c1a17] transition hover:border-[#8a6d43]">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.25} />
        </button>
        <button type="button" aria-label={`Next ${label}`} onClick={() => api?.scrollNext()} className="grid h-10 w-10 place-items-center border border-[#d9d2c4] text-[#1c1a17] transition hover:border-[#8a6d43]">
          <ChevronRight className="h-4 w-4" strokeWidth={1.25} />
        </button>
      </div>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-6">{children}</div>
      </div>
    </div>
  );
}

function SellerCarousel() {
  return (
    <Carousel label="sellers">
      {SELLERS.map((s, i) => (
        <article key={s.name} className="group w-[280px] shrink-0 sm:w-[340px]">
          <div className="relative aspect-[16/9] overflow-hidden bg-[#1a1917]">
            <Photo src={LUXURY_PHOTOS.banners[i]} alt={`${s.name} banner`} className="absolute inset-0" />
          </div>
          <div className="relative -mt-8 flex items-end gap-4 px-1">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-[#f7f4ee] bg-[#1a1917]">
              <Photo src={LUXURY_PHOTOS.logos[i]} alt={`${s.name} logo`} className="h-full w-full" zoomOnHover={false} />
            </div>
            <div className="pb-1">
              <h3 className="font-[family-name:var(--font-lux-serif)] text-2xl text-[#1c1a17]">{s.name}</h3>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[#6b655a]">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> {s.place}
          </p>
          <p className="mt-1 flex items-center justify-between text-[13px] text-[#6b655a]">
            <span>{s.specs}</span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> 4.7 <Demo />
            </span>
          </p>
        </article>
      ))}
    </Carousel>
  );
}

function StoneCard({ s }: { s: (typeof STONES)[number] }) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="group w-[260px] shrink-0 sm:w-[300px]">
      <div className="relative aspect-square overflow-hidden bg-[#1a1917]">
        <Photo src={s.photo} alt={s.name} className="absolute inset-0" />
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${s.name} from saved` : `Save ${s.name}`}
          onClick={() => setSaved((v) => !v)}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-[#0e0d0b]/50 text-white backdrop-blur-sm transition hover:bg-[#0e0d0b]/70"
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-[#d8c39b] text-[#d8c39b]" : ""}`} strokeWidth={1.25} />
        </button>
      </div>
      <div className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-[family-name:var(--font-lux-serif)] text-xl text-[#1c1a17]">{s.name}</h3>
          {s.verified ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] uppercase tracking-wider text-[#8a6d43]">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> Verified
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] text-[#6b655a]">{s.spec}</p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[15px] text-[#1c1a17]">{s.price}</p>
          <Demo />
        </div>
      </div>
    </article>
  );
}

function FeaturedCarousel() {
  return (
    <Carousel label="gemstones">
      {STONES.map((s, i) => (
        <StoneCard key={s.name} s={s} />
      ))}
    </Carousel>
  );
}

function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 gap-px bg-[#e3ddd2] sm:grid-cols-3">
      {CATEGORIES.map((c) => (
        <a key={c.key} href="#" onClick={(e) => e.preventDefault()} className="group relative aspect-[4/5] overflow-hidden bg-[#1a1917]">
          <Photo src={LUXURY_PHOTOS.categories[c.key]} alt={`${c.label} category`} className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
            <span className="font-[family-name:var(--font-lux-serif)] text-3xl text-white">{c.label}</span>
            <Maximize2 className="h-4 w-4 text-white/70 transition group-hover:text-[#e6d3a8]" strokeWidth={1.25} aria-hidden />
          </div>
        </a>
      ))}
    </div>
  );
}

function ProductGrid() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {STONES.map((s) => (
        <StoneCard key={`grid-${s.name}`} s={s} />
      ))}
    </div>
  );
}

function ProductTop() {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [open, setOpen] = useState(false);
  const images = [LUXURY_PHOTOS.stoneDetail[0], LUXURY_PHOTOS.stoneDetail[1], LUXURY_PHOTOS.stoneDetail[2]];
  const specs: [string, string][] = [
    ["Stone", "Cornflower sapphire"],
    ["Carat weight", "3.39 ct"],
    ["Shape", "Round brilliant"],
    ["Colour", "Cornflower blue"],
    ["Origin", "Sri Lanka (as declared by seller)"],
    ["Treatment", "None declared"],
    ["Certificate", "Lab report available on request"],
  ];
  return (
    <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <div
          className="group relative aspect-square cursor-zoom-in overflow-hidden bg-[#1a1917]"
          onClick={() => setZoom((z) => !z)}
          onMouseMove={(e) => {
            if (!zoom) return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--ox", `${((e.clientX - r.left) / r.width) * 100}%`);
            e.currentTarget.style.setProperty("--oy", `${((e.clientY - r.top) / r.height) * 100}%`);
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="absolute inset-0"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.85 }}
              transition={{ duration: 0.8 }}
              style={{ transformOrigin: "var(--ox, 50%) var(--oy, 50%)" }}
            >
              <div className={`absolute inset-0 transition-transform duration-[900ms] ease-out ${zoom ? "scale-[2.2]" : "scale-100"}`}>
                <Photo src={images[index]} alt="Cornflower sapphire, large view" className="absolute inset-0" zoomOnHover={false} />
              </div>
            </motion.div>
          </AnimatePresence>
          <button
            type="button"
            aria-label="Open full screen view"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center bg-[#0e0d0b]/60 text-white backdrop-blur-sm"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.25} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show view ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
              className={`relative aspect-square overflow-hidden bg-[#1a1917] ${index === i ? "outline outline-1 outline-offset-2 outline-[#8a6d43]" : "opacity-70 hover:opacity-100"}`}
            >
              <Photo src={src} alt="" className="absolute inset-0" zoomOnHover={false} />
            </button>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-10 lg:self-start">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a6d43]">Himalaya Gem House · Jaipur</p>
        <h3 className="mt-3 font-[family-name:var(--font-lux-serif)] text-4xl leading-tight text-[#1c1a17]">Cornflower sapphire, 3.39 ct</h3>
        <p className="mt-4 text-2xl text-[#1c1a17]">₹1,52,550</p>
        <p className="mt-1 flex items-center gap-2 text-[12px] text-[#6b655a]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#8a6d43]" strokeWidth={1.25} aria-hidden /> Verified seller · Indicative pricing, not a certified appraisal <Demo />
        </p>
        <div className="mt-8 grid gap-3">
          <button type="button" className="bg-[#1c1a17] px-6 py-4 text-sm tracking-wide text-[#f4f0e8] transition hover:bg-[#2e2b26]">
            Enquire with the seller
          </button>
          <button type="button" className="flex items-center justify-center gap-2 border border-[#1c1a17] px-6 py-4 text-sm tracking-wide text-[#1c1a17] transition hover:bg-[#1c1a17]/5">
            <Heart className="h-4 w-4" strokeWidth={1.25} aria-hidden /> Save to wishlist
          </button>
        </div>
        <div className="mt-10">
          <h4 className="text-[11px] uppercase tracking-[0.25em] text-[#8a6d43]">Specification</h4>
          <dl className="mt-4 divide-y divide-[#e3ddd2] border-y border-[#e3ddd2] text-[14px]">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-3">
                <dt className="text-[#6b655a]">{k}</dt>
                <dd className="text-[#1c1a17]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-8 flex items-start gap-4 border border-[#e3ddd2] p-5">
          <Mail className="mt-0.5 h-4 w-4 text-[#8a6d43]" strokeWidth={1.25} aria-hidden />
          <div className="text-[13px] leading-relaxed text-[#6b655a]">
            <p className="text-[#1c1a17]">Certificate and seller</p>
            <p>Lab report: available on request through the platform. Contact details stay private until you ask the seller through the site.</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Full screen view"
            className="fixed inset-0 z-50 grid place-items-center bg-[#0e0d0b]/95 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => setOpen(false)}
          >
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-6 top-6 text-white/80 hover:text-white">
              <X className="h-6 w-6" strokeWidth={1.25} />
            </button>
            <div className="relative aspect-square w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <Photo src={images[index]} alt="Cornflower sapphire, full screen" className="absolute inset-0" zoomOnHover={false} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SellerDashboardCard() {
  const rows = [
    ["Enquiry", "Pigeon blood ruby, 1.17 ct", "Today"],
    ["Quotation accepted", "Cornflower sapphire, 3.39 ct", "Yesterday"],
    ["Valuation ready", "Vivid green emerald, 1.54 ct", "3 days ago"],
  ];
  return (
    <div className="border border-[#e3ddd2] bg-white p-8 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a6d43]">Seller dashboard</p>
          <h3 className="mt-2 font-[family-name:var(--font-lux-serif)] text-3xl text-[#1c1a17]">Himalaya Gem House</h3>
        </div>
        <Demo />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-px bg-[#e3ddd2] sm:grid-cols-4">
        {[
          ["Profile views", "1,280"],
          ["Enquiries", "46"],
          ["Followers", "60"],
          ["Quotations", "9"],
        ].map(([k, v]) => (
          <div key={k} className="bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b655a]">{k}</p>
            <p className="mt-2 font-[family-name:var(--font-lux-serif)] text-3xl text-[#1c1a17]">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#8a6d43]">Recent activity</p>
        <ul className="mt-4 divide-y divide-[#e3ddd2] border-y border-[#e3ddd2]">
          {rows.map(([kind, what, when]) => (
            <li key={what} className="grid grid-cols-[1fr_auto] gap-4 py-4 text-[14px] sm:grid-cols-[10rem_1fr_auto]">
              <span className="text-[#1c1a17]">{kind}</span>
              <span className="hidden text-[#6b655a] sm:block">{what}</span>
              <span className="text-[12px] text-[#8a8478]">{when}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LuxuryPreview() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17] antialiased">
      <Hero />

      <section className="mx-auto max-w-7xl space-y-24 px-6 py-24 sm:px-10">
        <Fade>
          <SectionTitle eyebrow="Independent sellers" title="Top-rated sellers" />
        </Fade>
        <Fade>
          <SellerCarousel />
        </Fade>

        <Rule />

        <Fade>
          <SectionTitle eyebrow="Selected stones" title="Featured gemstones" />
        </Fade>
        <Fade>
          <FeaturedCarousel />
        </Fade>

        <Rule />

        <section id="categories" className="space-y-10">
          <Fade>
            <SectionTitle eyebrow="Browse" title="By gemstone" />
          </Fade>
          <Fade>
            <CategoryTiles />
          </Fade>
        </section>

        <Rule />

        <section className="space-y-10">
          <Fade>
            <SectionTitle eyebrow="The collection" title="New to the platform" />
          </Fade>
          <Fade>
            <ProductGrid />
          </Fade>
        </section>

        <Rule />

        <section id="product" className="space-y-10">
          <Fade>
            <SectionTitle eyebrow="Product" title="Stone detail" />
          </Fade>
          <Fade>
            <ProductTop />
          </Fade>
        </section>

        <Rule />

        <section id="dashboard" className="space-y-10">
          <Fade>
            <SectionTitle eyebrow="For sellers" title="Your dashboard" />
          </Fade>
          <Fade>
            <SellerDashboardCard />
          </Fade>
        </section>
      </section>
    </div>
  );
}
