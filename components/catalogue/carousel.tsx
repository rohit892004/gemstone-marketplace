"use client";

import { type ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const arrow =
    "grid h-11 w-11 place-items-center border border-line text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <section aria-label={label} className="relative">
      <div className="mb-6 flex justify-end gap-2">
        <button type="button" onClick={() => scrollByPage(-1)} aria-label={`Previous: ${label}`} className={arrow}>
          <ChevronLeft className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        </button>
        <button type="button" onClick={() => scrollByPage(1)} aria-label={`Next: ${label}`} className={arrow}>
          <ChevronRight className="h-4 w-4" strokeWidth={1.25} aria-hidden />
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
        className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-3 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:-mx-0 sm:px-0"
      >
        {children}
      </div>
    </section>
  );
}

/** Wrap each carousel item in this so it snaps and keeps a fixed width on every breakpoint. */
export function CarouselItem({ children }: { children: ReactNode }) {
  return <div className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px]">{children}</div>;
}
