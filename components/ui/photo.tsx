"use client";

import { Gem } from "lucide-react";
import { useState } from "react";
import { cx } from "./cx";

/**
 * A photograph in a fixed-ratio box. The box is sized by the parent (or `ratio`), so nothing shifts while
 * the image loads. Images are lazy and async-decoded unless `priority` is set (use it only for the first
 * above-the-fold image). If the file fails, a plain panel with the alt text as its label is shown instead.
 */
export function Photo({
  src,
  alt,
  ratio = "aspect-[4/5]",
  className,
  imgClassName,
  zoomOnHover = true,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
  src: string;
  alt: string;
  /** Tailwind aspect class used when the parent does not size the box. */
  ratio?: string;
  className?: string;
  imgClassName?: string;
  zoomOnHover?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = cx("relative overflow-hidden bg-panel", ratio, className);

  if (failed || !src) {
    // No photo: an ivory panel with a thin gem line icon, never a cartoon or a flat colour block.
    // Empty alt means decorative: hide the panel from assistive technology instead of labelling it.
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cx("relative overflow-hidden border border-line bg-surface-raised", ratio, className)}
      >
        <div className="absolute inset-0 grid place-items-center text-accent/70">
          <Gem className="h-1/4 max-h-16 min-h-8 w-auto" strokeWidth={0.9} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className={box}>
      {/* Static assets and API media routes; plain img keeps session cookies on the request. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cx(
          "absolute inset-0 h-full w-full object-cover",
          "transition-transform duration-[1400ms] ease-[var(--ease-lux)]",
          zoomOnHover && "group-hover:scale-[1.03]",
          imgClassName,
        )}
      />
    </div>
  );
}
