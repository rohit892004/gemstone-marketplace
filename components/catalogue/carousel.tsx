"use client";

import { type ReactNode, useRef } from "react";
import { useImpressionTracking } from "@/components/analytics/track";

/**
 * Horizontal carousel: scroll-snap for touch and trackpad swiping, previous/next buttons,
 * and arrow keys when the region has focus. Items are plain children, so server-rendered
 * cards stay server-rendered.
 */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  useImpressionTracking(trackRef);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section aria-roledescription="carousel" aria-label={label} className="relative">
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label={`Previous: ${label}`}
          className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm hover:border-ink-soft"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label={`Next: ${label}`}
          className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm hover:border-ink-soft"
        >
          →
        </button>
      </div>
      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label={`${label}, use arrow keys to scroll`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            scrollByPage(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            scrollByPage(-1);
          }
        }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin] focus-visible:outline-2"
      >
        {children}
      </div>
    </section>
  );
}

/** Wrap each carousel item in this so it snaps and keeps a fixed width on every breakpoint. */
export function CarouselItem({ children }: { children: ReactNode }) {
  return <div className="w-72 shrink-0 snap-start sm:w-80">{children}</div>;
}
