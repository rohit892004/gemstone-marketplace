"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { cx } from "./cx";

/**
 * Horizontal carousel built on native scroll-snap: touch, trackpad and drag work without a library.
 * Previous and next buttons scroll one page; arrow keys work when the track has focus. Items stay ordinary
 * children, so server-rendered cards remain server-rendered. The region is labelled and announced as a carousel.
 */
export function Carousel({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const trackRef = useRef<HTMLUListElement>(null);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByPage(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByPage(-1);
    }
  }

  const items = Array.isArray(children) ? children : [children];

  return (
    <section aria-roledescription="carousel" aria-label={label} className={cx("relative", className)}>
      <div className="mb-6 flex justify-end gap-2">
        <button
          type="button"
          aria-label={`Previous ${label}`}
          onClick={() => scrollByPage(-1)}
          className="grid h-11 w-11 place-items-center border border-line text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Next ${label}`}
          onClick={() => scrollByPage(1)}
          className="grid h-11 w-11 place-items-center border border-line text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        </button>
      </div>
      <ul
        ref={trackRef}
        tabIndex={0}
        aria-label={`${label}, use arrow keys to scroll`}
        onKeyDown={onKeyDown}
        className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-2 sm:-mx-0 sm:px-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [scrollbar-width:thin]"
      >
        {items.map((child, i) => (
          <li
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}`}
            className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px]"
          >
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
