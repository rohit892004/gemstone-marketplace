"use client";

import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  LayoutDashboard,
  MessageSquare,
  PackageCheck,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GemArt, type GemKey } from "./gem-art";
import type { DesignTheme } from "./themes";

/** Demo data only. Every figure and name here is a placeholder for testing the look. */
const CATEGORIES: { name: string; gem: GemKey }[] = [
  { name: "Diamond", gem: "diamond" },
  { name: "Emerald", gem: "emerald" },
  { name: "Ruby", gem: "ruby" },
  { name: "Sapphire", gem: "sapphire" },
  { name: "Spinel", gem: "spinel" },
  { name: "Tourmaline", gem: "tourmaline" },
];

const STONES: { id: string; name: string; seller: string; price: string; gem: GemKey; verified: boolean }[] = [
  { id: "s1", name: "Pigeon blood Ruby, 1.17 ct", seller: "Deccan Stone Works", price: "₹70,200", gem: "ruby", verified: true },
  { id: "s2", name: "Cornflower Sapphire, 3.39 ct", seller: "Himalaya Gem House", price: "₹1,52,550", gem: "sapphire", verified: true },
  { id: "s3", name: "Vivid green Emerald, 1.54 ct", seller: "Coastal Gem Exchange", price: "₹80,080", gem: "emerald", verified: false },
  { id: "s4", name: "G colour Diamond, 2.65 ct", seller: "Thar Valley Stones", price: "₹3,18,000", gem: "diamond", verified: true },
  { id: "s5", name: "Hot pink Spinel, 1.91 ct", seller: "Surat Colour Co", price: "₹34,380", gem: "spinel", verified: false },
  { id: "s6", name: "Watermelon Tourmaline, 2.28 ct", seller: "Malabar Precious Gems", price: "Price on request", gem: "tourmaline", verified: true },
];

const SELLERS: { name: string; place: string; rating: string; specs: string; gem: GemKey }[] = [
  { name: "Deccan Stone Works", place: "Hyderabad, Telangana", rating: "4.3", specs: "Emerald · Tourmaline", gem: "emerald" },
  { name: "Himalaya Gem House", place: "Jaipur, Rajasthan", rating: "4.7", specs: "Sapphire · Ruby", gem: "sapphire" },
  { name: "Coastal Gem Exchange", place: "Mumbai, Maharashtra", rating: "4.7", specs: "Diamond · Spinel", gem: "diamond" },
  { name: "Malabar Precious Gems", place: "Kochi, Kerala", rating: "4.3", specs: "Diamond · Emerald", gem: "ruby" },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return { ref, inView };
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useReveal();
  return (
    <motion.div
      ref={ref}
      className={className}
      // Content is never hidden: it only starts a few pixels low and settles when scrolled into view.
      initial={reduce ? false : { y: 24 }}
      animate={inView || reduce ? { y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to a number when it scrolls into view. The label marks the figure as demo data. */
function CountUp({ to, label, suffix = "" }: { to: number; label: string; suffix?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.6, ease: "easeOut", onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, reduce]);
  return (
    <div ref={ref} className="text-center">
      <div className="font-[family-name:var(--font-heading)] text-4xl font-semibold sm:text-5xl">
        {value.toLocaleString("en-IN")}
        {suffix}
      </div>
      <div className="mt-1 text-sm">{label}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest opacity-70">Demo number</div>
    </div>
  );
}

function Sparkles_({ theme }: { theme: DesignTheme }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {[12, 28, 44, 63, 78, 90].map((left, i) => (
        <motion.span
          key={left}
          className={`absolute h-1.5 w-1.5 rounded-full ${theme.accentBg}`}
          style={{ left: `${left}%`, top: `${10 + ((i * 17) % 70)}%` }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.4, 0.6] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}

function Hero({ theme }: { theme: DesignTheme }) {
  const reduce = useReducedMotion();
  const [chip, setChip] = useState("All");
  const words = "Discover gemstones worth keeping.".split(" ");
  return (
    <section className={`relative overflow-hidden rounded-3xl ${theme.hero}`}>
      <motion.div
        aria-hidden
        className={`absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full opacity-70 blur-2xl ${theme.heroOrb}`}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
      <Sparkles_ theme={theme} />
      <div className="relative grid items-center gap-10 px-6 py-14 sm:px-12 lg:grid-cols-2 lg:py-20">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${theme.accentText}`}>Verified sellers · Demo</p>
          <h1 className={`mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl ${theme.heading}`}>
            {words.map((w, i) => (
              <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom pr-3">
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              </span>
            ))}
          </h1>
          <p className={`mt-5 max-w-xl text-lg ${theme.muted}`}>
            Browse stones from verified sellers, speak to them on the platform, and request an indicative valuation.
          </p>

          <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
            <label className="relative flex-1">
              <span className="sr-only">Search gemstones</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-60" aria-hidden />
              <input
                className={`h-14 w-full rounded-2xl border pl-12 pr-4 text-base outline-none transition focus:ring-4 ${theme.input}`}
                placeholder="Search sapphire, ruby, emerald, origin…"
              />
            </label>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-8 font-semibold transition ${theme.button}`}
            >
              Search <ArrowRight className="h-4 w-4" aria-hidden />
            </motion.button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Category">
            {["All", ...CATEGORIES.map((c) => c.name)].map((name) => (
              <motion.button
                key={name}
                type="button"
                aria-pressed={chip === name}
                onClick={() => setChip(name)}
                whileTap={{ scale: 0.94 }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${chip === name ? theme.chipOn : theme.chipOff}`}
              >
                {name}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md">
          <motion.div
            className="absolute inset-0"
            animate={reduce ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <GemArt gem={theme.gems[1]} id={`hero-${theme.id}`} label="Featured sapphire, demo illustration" glow={theme.glow} className="h-full w-full" />
          </motion.div>
          <motion.div
            className="absolute -bottom-2 -left-2 rounded-2xl border border-white/30 bg-white/80 px-4 py-3 text-sm shadow-xl backdrop-blur-md"
            initial={reduce ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
          >
            <span className="font-semibold text-[#14122b]">Cornflower Sapphire</span>
            <span className="ml-2 text-[#5b5878]">· Demo</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stats({ theme }: { theme: DesignTheme }) {
  return (
    <div className={`grid grid-cols-3 gap-6 rounded-3xl px-6 py-10 ${theme.card}`}>
      <CountUp to={6} label="Sellers" />
      <CountUp to={40} label="Gemstones" suffix="+" />
      <CountUp to={18} label="Verified reviews" />
    </div>
  );
}

function CategoryTiles({ theme }: { theme: DesignTheme }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {CATEGORIES.map((c, i) => (
        <Reveal key={c.name} delay={i * 0.05}>
          <motion.a
            href="#"
            onClick={(e) => e.preventDefault()}
            whileHover={{ y: -6 }}
            className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl ${theme.tile} ${theme.card}`}
          >
            <GemArt gem={c.gem} id={`cat-${theme.id}-${i}`} className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] transition duration-700 group-hover:scale-110 group-hover:rotate-6" />
            <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-[#14122b]">{c.name}</span>
          </motion.a>
        </Reveal>
      ))}
    </div>
  );
}

function useCarousel() {
  const [ref, api] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });
  return { ref, prev: () => api?.scrollPrev(), next: () => api?.scrollNext() };
}

function Toast({ text, theme }: { text: string | null; theme: DesignTheme }) {
  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          role="status"
          key={text}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium shadow-2xl ${theme.toast}`}
        >
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function StoneCards({ theme, onToast }: { theme: DesignTheme; onToast: (t: string) => void }) {
  const { ref, prev, next } = useCarousel();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <button type="button" onClick={prev} aria-label="Previous" className={`rounded-full p-2 ${theme.buttonGhost}`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={next} aria-label="Next" className={`rounded-full p-2 ${theme.buttonGhost}`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-5">
          {STONES.map((s, i) => (
            <motion.article
              key={s.id}
              whileHover={{ y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`group relative w-64 shrink-0 overflow-hidden rounded-3xl ${theme.card} ${theme.cardHover}`}
            >
              <div className="relative aspect-square overflow-hidden">
                <GemArt
                  gem={s.gem}
                  id={`stone-${theme.id}-${i}`}
                  label={`${s.name}, demo illustration`}
                  glow={theme.glow}
                  className="h-full w-full p-6 transition duration-700 group-hover:scale-110 group-hover:-rotate-3"
                />
                <motion.button
                  type="button"
                  aria-pressed={!!saved[s.id]}
                  aria-label={saved[s.id] ? `Remove ${s.name} from wishlist` : `Save ${s.name} to wishlist`}
                  whileTap={{ scale: 0.7 }}
                  animate={{ scale: saved[s.id] ? [1, 1.35, 1] : 1 }}
                  transition={{ duration: 0.35 }}
                  onClick={() => {
                    setSaved((prev) => ({ ...prev, [s.id]: !prev[s.id] }));
                    onToast(saved[s.id] ? "Removed from your wishlist" : "Saved to your wishlist");
                  }}
                  className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-[#14122b] shadow-md"
                >
                  <Heart className={`h-5 w-5 ${saved[s.id] ? "fill-[#e11d48] text-[#e11d48]" : ""}`} />
                </motion.button>
                {s.verified ? (
                  <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.badge}`}>
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                  </span>
                ) : null}
              </div>
              <div className="p-5">
                <h3 className={`text-lg font-semibold ${theme.heading}`}>{s.name}</h3>
                <p className={`mt-1 text-sm ${theme.muted}`}>{s.seller}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold">{s.price}</span>
                  <span className={`text-xs font-medium ${theme.accentText}`}>Demo</span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}

function SellerCards({ theme }: { theme: DesignTheme }) {
  const { ref, prev, next } = useCarousel();
  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <button type="button" onClick={prev} aria-label="Previous seller" className={`rounded-full p-2 ${theme.buttonGhost}`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={next} aria-label="Next seller" className={`rounded-full p-2 ${theme.buttonGhost}`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-5">
          {SELLERS.map((s, i) => (
            <motion.article
              key={s.name}
              whileHover={{ y: -6 }}
              className={`group w-72 shrink-0 overflow-hidden rounded-3xl ${theme.card} ${theme.cardHover}`}
            >
              <div className="relative h-24 overflow-hidden">
                <div className={`absolute inset-0 transition duration-700 group-hover:scale-105 ${theme.tile}`} />
                <GemArt gem={s.gem} id={`seller-${theme.id}-${i}`} className="absolute -bottom-6 right-4 h-20 w-20" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-full font-bold ${theme.badge}`}>{s.name[0]}</span>
                  <div>
                    <h3 className={`font-semibold ${theme.heading}`}>{s.name}</h3>
                    <p className={`text-xs ${theme.muted}`}>{s.place}</p>
                  </div>
                </div>
                <p className={`mt-3 text-sm ${theme.muted}`}>{s.specs}</p>
                <p className="mt-2 flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden /> {s.rating}
                  <span className={`ml-2 text-xs ${theme.accentText}`}>Demo rating</span>
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowItWorks({ theme }: { theme: DesignTheme }) {
  const buyer = [
    { icon: Search, title: "Search and compare", text: "Filter by stone, carat and origin." },
    { icon: MessageSquare, title: "Ask the seller", text: "Chat on the platform. Contact stays private." },
    { icon: ShieldCheck, title: "Buy with confidence", text: "Accept a quotation and keep the record." },
  ];
  const seller = [
    { icon: Award, title: "Apply and get verified", text: "Share your business documents once." },
    { icon: PackageCheck, title: "List your stones", text: "Photos, specs and pricing in one place." },
    { icon: TrendingUp, title: "Grow your reach", text: "See views and enquiries in your analytics." },
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {[
        { label: "For buyers", steps: buyer },
        { label: "For sellers", steps: seller },
      ].map((group) => (
        <div key={group.label} className={`rounded-3xl p-8 ${theme.card}`}>
          <h3 className={`text-2xl font-semibold ${theme.heading}`}>{group.label}</h3>
          <ol className="mt-6 space-y-6">
            {group.steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.15}>
                <li className="flex gap-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${theme.badge}`}>
                    <step.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">
                      {i + 1}. {step.title}
                    </p>
                    <p className={`text-sm ${theme.muted}`}>{step.text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function ProductTop({ theme, onToast }: { theme: DesignTheme; onToast: (t: string) => void }) {
  const [view, setView] = useState(0);
  const views: GemKey[] = ["sapphire", "diamond", "sapphire"];
  const [zoom, setZoom] = useState(false);
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <motion.div
          layout
          className={`relative aspect-square overflow-hidden rounded-3xl ${theme.tile} ${theme.card}`}
          onMouseMove={(e) => {
            if (!zoom) return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--ox", `${((e.clientX - r.left) / r.width) * 100}%`);
            e.currentTarget.style.setProperty("--oy", `${((e.clientY - r.top) / r.height) * 100}%`);
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, rotate: -6, scale: 0.92 }}
              animate={{ opacity: 1, rotate: 0, scale: zoom ? 1.8 : 1 }}
              exit={{ opacity: 0, rotate: 6, scale: 0.92 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
              style={{ transformOrigin: "var(--ox, 50%) var(--oy, 50%)" }}
            >
              <GemArt gem={views[view]} id={`pdp-${theme.id}-${view}`} label="Sapphire, demo illustration" glow={theme.glow} className="h-full w-full p-10" />
            </motion.div>
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            aria-pressed={zoom}
            className={`absolute bottom-4 right-4 rounded-full px-4 py-2 text-sm font-medium shadow ${theme.button}`}
          >
            {zoom ? "Reset zoom" : "Zoom"}
          </button>
        </motion.div>
        <div className="mt-4 flex gap-3">
          {views.map((g, i) => (
            <button
              key={`${g}-${i}`}
              type="button"
              aria-label={`View ${i + 1}`}
              aria-pressed={view === i}
              onClick={() => setView(i)}
              className={`relative h-20 w-20 overflow-hidden rounded-2xl border-2 transition ${view === i ? "border-current" : "border-transparent opacity-70 hover:opacity-100"} ${theme.card}`}
            >
              <GemArt gem={g} id={`thumb-${theme.id}-${i}`} className="h-full w-full p-2" />
            </button>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Sapphire · Demo</p>
        <h3 className={`mt-2 text-3xl font-semibold leading-tight ${theme.heading}`}>Cornflower Sapphire, 3.39 ct Round</h3>
        <p className={`mt-2 text-sm ${theme.muted}`}>Himalaya Gem House · Jaipur, Rajasthan</p>

        <div className={`mt-6 rounded-3xl p-6 ${theme.card}`}>
          <p className="text-3xl font-semibold">₹1,52,550</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified seller
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
              <Award className="h-3.5 w-3.5" aria-hidden /> Lab report
              <span className="sr-only">: certificate available on request</span>
            </span>
          </div>
          <div className="mt-6 grid gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onToast("Enquiry started (preview only)")}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold ${theme.button}`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> Chat with the seller
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onToast("Saved to your wishlist")}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold ${theme.buttonGhost}`}
            >
              <Heart className="h-4 w-4" aria-hidden /> Save to wishlist
            </motion.button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { icon: Sparkles, k: "Colour", v: "Cornflower blue" },
            { icon: Scale, k: "Carat", v: "3.39 ct" },
            { icon: Eye, k: "Shape", v: "Round" },
            { icon: ShieldCheck, k: "Origin", v: "Sri Lanka (demo)" },
          ].map((spec) => (
            <div key={spec.k} className={`rounded-2xl p-4 ${theme.card}`}>
              <spec.icon className={`h-5 w-5 ${theme.accentText}`} aria-hidden />
              <p className={`mt-2 text-xs uppercase tracking-wider ${theme.muted}`}>{spec.k}</p>
              <p className="font-semibold">{spec.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ theme }: { theme: DesignTheme }) {
  const bars = [42, 68, 35, 80, 57, 92, 64];
  const reduce = useReducedMotion();
  return (
    <div className={`rounded-3xl p-6 sm:p-8 ${theme.card}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${theme.badge}`}>
          <LayoutDashboard className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className={`text-xl font-semibold ${theme.heading}`}>Seller dashboard · Demo</h3>
          <p className={`text-sm ${theme.muted}`}>Your week at a glance</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Eye, label: "Profile views", value: 1280 },
          { icon: MessageSquare, label: "Enquiries", value: 46 },
          { icon: Users, label: "Followers", value: 60 },
          { icon: Wallet, label: "Quotations sent", value: 9 },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl p-4 ${theme.tile}`}>
            <k.icon className={`h-5 w-5 ${theme.accentText}`} aria-hidden />
            <p className="mt-3 text-2xl font-semibold">
              <CountUpInline to={k.value} reduce={!!reduce} />
            </p>
            <p className={`text-xs ${theme.muted}`}>{k.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex h-40 items-end gap-3" role="img" aria-label="Demo chart: enquiries this week">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-t-xl ${theme.accentBg}`}
            initial={reduce ? false : { height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { label: "Approved", cls: theme.badge },
          { label: "Awaiting review", cls: "bg-amber-100 text-amber-800" },
          { label: "Sold", cls: "bg-rose-100 text-rose-700" },
        ].map((b) => (
          <span key={b.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${b.cls}`}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CountUpInline({ to, reduce }: { to: number; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.2, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, reduce]);
  return <span ref={ref}>{value.toLocaleString("en-IN")}</span>;
}

function ValuationBand({ theme }: { theme: DesignTheme }) {
  return (
    <div className={`flex flex-col items-start gap-6 rounded-3xl p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12 ${theme.band} ${theme.bandText}`}>
      <div>
        <h3 className={`text-3xl font-semibold ${theme.heading}`}>Not sure what your stone is worth?</h3>
        <p className="mt-2 max-w-xl opacity-80">Send photos and details and get an indicative valuation from our expert team.</p>
      </div>
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-semibold text-[#14122b]"
      >
        Start a valuation <ArrowRight className="h-4 w-4" aria-hidden />
      </motion.button>
    </div>
  );
}

function ContentCards({ theme }: { theme: DesignTheme }) {
  const items = [
    { gem: "emerald" as GemKey, tag: "Education", title: "How to judge emerald clarity", meta: "6 min read · Demo" },
    { gem: "ruby" as GemKey, tag: "Market news", title: "Ruby prices hold steady this quarter", meta: "Demo source" },
    { gem: "diamond" as GemKey, tag: "Guide", title: "Reading a diamond certificate", meta: "5 min read · Demo" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((it, i) => (
        <Reveal key={it.title} delay={i * 0.1}>
          <motion.article whileHover={{ y: -6 }} className={`group overflow-hidden rounded-3xl ${theme.card} ${theme.cardHover}`}>
            <div className={`relative aspect-[16/10] overflow-hidden ${theme.tile}`}>
              <GemArt gem={it.gem} id={`content-${theme.id}-${i}`} className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] transition duration-700 group-hover:scale-110" />
            </div>
            <div className="p-6">
              <p className={`text-xs font-semibold uppercase tracking-wider ${theme.accentText}`}>{it.tag}</p>
              <h3 className={`mt-2 text-xl font-semibold leading-snug ${theme.heading}`}>{it.title}</h3>
              <p className={`mt-3 text-sm ${theme.muted}`}>{it.meta}</p>
            </div>
          </motion.article>
        </Reveal>
      ))}
    </div>
  );
}

function NewsletterBand({ theme, onToast }: { theme: DesignTheme; onToast: (t: string) => void }) {
  return (
    <div className={`rounded-3xl p-8 sm:p-12 ${theme.card}`}>
      <div className="grid items-center gap-6 lg:grid-cols-2">
        <div>
          <h3 className={`text-3xl font-semibold ${theme.heading}`}>The Gemstone letter</h3>
          <p className={`mt-2 ${theme.muted}`}>New listings, guides and market notes, chosen by you. We confirm every address first.</p>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onToast("Preview only: confirmation email would be sent");
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Email address</span>
            <input className={`h-14 w-full rounded-2xl border px-4 outline-none focus:ring-4 ${theme.input}`} placeholder="you@example.com" type="email" />
          </label>
          <motion.button type="submit" whileTap={{ scale: 0.96 }} className={`h-14 rounded-2xl px-7 font-semibold ${theme.button}`}>
            Sign up
          </motion.button>
        </form>
      </div>
    </div>
  );
}

export function DesignPreview({ theme }: { theme: DesignTheme }) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className={`min-h-screen ${theme.page}`}>

      <main className="mx-auto max-w-7xl space-y-20 px-5 py-10 sm:py-14">
        <p className={`text-sm ${theme.muted}`}>
          Preview only, for choosing a direction. {theme.summary} Demo data and demo illustrations.
        </p>
        <Hero theme={theme} />
        <Reveal>
          <Stats theme={theme} />
        </Reveal>

        <section id="categories" className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Shop by gemstone</h2>
          </Reveal>
          <CategoryTiles theme={theme} />
        </section>

        <section id="sellers" className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Top-rated sellers</h2>
          </Reveal>
          <SellerCards theme={theme} />
        </section>

        <section className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Featured gemstones</h2>
          </Reveal>
          <StoneCards theme={theme} onToast={setToast} />
        </section>

        <section className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>How it works</h2>
          </Reveal>
          <HowItWorks theme={theme} />
        </section>

        <ValuationBand theme={theme} />

        <section className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Learn and read</h2>
          </Reveal>
          <ContentCards theme={theme} />
        </section>

        <NewsletterBand theme={theme} onToast={setToast} />

        <section id="product" className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Product page, top</h2>
          </Reveal>
          <ProductTop theme={theme} onToast={setToast} />
        </section>

        <section id="dashboard" className="space-y-6">
          <Reveal>
            <h2 className={`text-3xl font-semibold ${theme.heading}`}>Dashboard card</h2>
          </Reveal>
          <DashboardCard theme={theme} />
        </section>
      </main>

      <Toast text={toast} theme={theme} />
    </div>
  );
}
