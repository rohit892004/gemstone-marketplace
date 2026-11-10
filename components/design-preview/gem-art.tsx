/**
 * Original faceted-gem illustration, drawn in SVG. Stands in for product photography in the design previews.
 * Colours are passed in, so each direction can light the same stone differently.
 */
export interface GemPalette {
  light: string;
  mid: string;
  deep: string;
}

export const GEM_PALETTES = {
  ruby: { light: "#ff7a8a", mid: "#c81e3c", deep: "#5a0a1a" },
  sapphire: { light: "#7ab8ff", mid: "#1f4fb4", deep: "#0a1f4d" },
  emerald: { light: "#7fe0b0", mid: "#0f7a4f", deep: "#063a25" },
  diamond: { light: "#ffffff", mid: "#c9d3e0", deep: "#7b8799" },
  spinel: { light: "#ff9ad0", mid: "#c2358a", deep: "#4f0f36" },
  tourmaline: { light: "#ffb3a7", mid: "#c86a5a", deep: "#5a2a22" },
} satisfies Record<string, GemPalette>;

export type GemKey = keyof typeof GEM_PALETTES;

export function GemArt({
  gem,
  className,
  label,
  glow = false,
  id,
}: {
  gem: GemKey;
  className?: string;
  label?: string;
  glow?: boolean;
  id: string;
}) {
  const p = GEM_PALETTES[gem];
  const gradId = `g-${id}`;
  const shineId = `s-${id}`;
  return (
    <svg
      viewBox="0 0 200 200"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 28px ${p.mid})` } : undefined}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.light} />
          <stop offset="55%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.deep} />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Girdle outline and crown facets */}
      <polygon points="100,18 168,62 150,162 100,184 50,162 32,62" fill={`url(#${gradId})`} />
      <polygon points="100,18 168,62 100,78 32,62" fill="#ffffff" fillOpacity="0.18" />
      <polygon points="100,78 168,62 150,162" fill="#000000" fillOpacity="0.08" />
      <polygon points="100,78 32,62 50,162" fill="#ffffff" fillOpacity="0.1" />
      <polygon points="100,78 50,162 100,184 150,162" fill="#000000" fillOpacity="0.14" />
      <polygon points="100,18 100,78 168,62" fill="#ffffff" fillOpacity="0.22" />
      <polygon points="100,18 100,78 32,62" fill="#ffffff" fillOpacity="0.06" />
      {/* Table highlight */}
      <polygon points="100,30 150,62 100,72 50,62" fill={`url(#${shineId})`} fillOpacity="0.7" />
      {/* Sparkle */}
      <path d="M150 34 L153 44 L163 47 L153 50 L150 60 L147 50 L137 47 L147 44 Z" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  );
}
