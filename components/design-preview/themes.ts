import type { GemKey } from "./gem-art";

/**
 * Three preview directions. Each one changes colour, surface, shadow, and type; the layout and interactions are shared.
 * Class names are written out in full so Tailwind can see them.
 */
export interface DesignTheme {
  id: "a" | "b" | "c";
  name: string;
  summary: string;
  page: string;
  muted: string;
  heading: string;
  accentText: string;
  accentBg: string;
  button: string;
  buttonGhost: string;
  card: string;
  cardHover: string;
  chipOff: string;
  chipOn: string;
  hero: string;
  heroOrb: string;
  band: string;
  bandText: string;
  input: string;
  badge: string;
  toast: string;
  tile: string;
  gems: GemKey[];
  glow: boolean;
}

export const THEMES: Record<"a" | "b" | "c", DesignTheme> = {
  a: {
    id: "a",
    name: "Royal Ivory & Gold",
    summary: "Warm ivory, charcoal, and gold. Serif headings, soft shadows, and quiet sparkle.",
    page: "bg-[#f7f1e3] text-[#2b241c]",
    muted: "text-[#6f6252]",
    heading: "font-[family-name:var(--font-heading)] tracking-tight",
    accentText: "text-[#a9822f]",
    accentBg: "bg-[#a9822f]",
    button: "bg-[#2b241c] text-[#f7f1e3] hover:bg-[#3d3428]",
    buttonGhost: "border border-[#2b241c]/30 text-[#2b241c] hover:bg-[#2b241c]/5",
    card: "bg-white border border-[#e6d9b8] shadow-[0_20px_50px_-24px_rgba(74,52,16,0.35)]",
    cardHover: "hover:shadow-[0_28px_60px_-22px_rgba(74,52,16,0.45)]",
    chipOff: "border-[#d7c69b] bg-white text-[#2b241c] hover:border-[#a9822f]",
    chipOn: "border-[#2b241c] bg-[#2b241c] text-[#f7f1e3]",
    hero: "bg-[radial-gradient(ellipse_at_top_right,#fff6dc_0%,#f7f1e3_45%,#efe3c4_100%)]",
    heroOrb: "bg-[radial-gradient(circle,#e7c979_0%,rgba(231,201,121,0)_70%)]",
    band: "bg-[#2b241c]",
    bandText: "text-[#f7f1e3]",
    input: "border-[#d7c69b] bg-white focus:border-[#a9822f] focus:ring-[#a9822f]/30",
    badge: "bg-[#efe3c4] text-[#6f5620]",
    toast: "bg-[#2b241c] text-[#f7f1e3]",
    tile: "bg-[linear-gradient(160deg,#fffdf6,#efe3c4)]",
    gems: ["diamond", "sapphire", "emerald", "ruby"],
    glow: false,
  },
  b: {
    id: "b",
    name: "Midnight Jewel",
    summary: "Deep navy and black, glowing jewel tones, glass cards, and dramatic light on the stones.",
    page: "bg-[#070b17] text-[#e9edf8]",
    muted: "text-[#9aa6c4]",
    heading: "font-[family-name:var(--font-heading)] tracking-tight",
    accentText: "text-[#7ee3c0]",
    accentBg: "bg-[#2fd3a0]",
    button: "bg-[#2fd3a0] text-[#04110d] hover:bg-[#5fe0b6]",
    buttonGhost: "border border-white/20 text-white hover:bg-white/10",
    card: "bg-white/[0.06] border border-white/10 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
    cardHover: "hover:bg-white/[0.1] hover:shadow-[0_30px_70px_-18px_rgba(47,211,160,0.35)]",
    chipOff: "border-white/15 bg-white/[0.04] text-[#cfd7ec] hover:border-[#2fd3a0]",
    chipOn: "border-[#2fd3a0] bg-[#2fd3a0]/15 text-[#7ee3c0]",
    hero: "bg-[radial-gradient(ellipse_at_30%_20%,#14224a_0%,#070b17_60%)]",
    heroOrb: "bg-[radial-gradient(circle,#2b5cff_0%,rgba(43,92,255,0)_70%)]",
    band: "bg-white/[0.05] border-y border-white/10",
    bandText: "text-[#e9edf8]",
    input: "border-white/15 bg-white/[0.05] text-white placeholder:text-white/40 focus:border-[#2fd3a0] focus:ring-[#2fd3a0]/30",
    badge: "bg-[#2fd3a0]/15 text-[#7ee3c0]",
    toast: "bg-[#e9edf8] text-[#070b17]",
    tile: "bg-[linear-gradient(160deg,#14224a,#070b17)]",
    gems: ["sapphire", "emerald", "ruby", "spinel"],
    glow: true,
  },
  c: {
    id: "c",
    name: "Vibrant Gem",
    summary: "White base with bold jewel-tone gradients, colourful tiles, and playful motion.",
    page: "bg-white text-[#14122b]",
    muted: "text-[#5b5878]",
    heading: "font-[family-name:var(--font-heading)] tracking-tight",
    accentText: "text-[#7c3aed]",
    accentBg: "bg-[#7c3aed]",
    button: "bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white hover:brightness-110",
    buttonGhost: "border-2 border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/5",
    card: "bg-white border border-[#ece8ff] shadow-[0_16px_40px_-20px_rgba(124,58,237,0.35)]",
    cardHover: "hover:shadow-[0_26px_50px_-18px_rgba(236,72,153,0.4)]",
    chipOff: "border-[#e0d8ff] bg-white text-[#14122b] hover:border-[#7c3aed]",
    chipOn: "border-transparent bg-gradient-to-r from-[#0ea5e9] to-[#7c3aed] text-white",
    hero: "bg-[linear-gradient(120deg,#fdf4ff_0%,#eef2ff_45%,#ecfeff_100%)]",
    heroOrb: "bg-[conic-gradient(from_0deg,#ec4899,#7c3aed,#0ea5e9,#10b981,#ec4899)]",
    band: "bg-gradient-to-r from-[#0ea5e9] via-[#7c3aed] to-[#ec4899]",
    bandText: "text-white",
    input: "border-[#e0d8ff] bg-white focus:border-[#7c3aed] focus:ring-[#7c3aed]/30",
    badge: "bg-[#f3e8ff] text-[#6d28d9]",
    toast: "bg-[#14122b] text-white",
    tile: "bg-[linear-gradient(135deg,#ec4899,#7c3aed)]",
    gems: ["ruby", "emerald", "sapphire", "tourmaline"],
    glow: false,
  },
};
