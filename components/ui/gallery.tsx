"use client";

import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "./cx";
import { Modal } from "./modal";
import { Photo } from "./photo";

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Product gallery: one large view, a thumbnail row, a zoom toggle (2.5x, drag to pan) and a full-screen lightbox.
 * Keyboard: left and right arrows change the image on the focused main view, Enter or Space toggles zoom,
 * and the lightbox closes with Escape. Every control is a labelled button.
 */
export function Gallery({ images, className }: { images: GalleryImage[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;
  const current = images[index];

  const go = useCallback(
    (next: number) => {
      setZoomed(false);
      setIndex((next + count) % count);
    },
    [count],
  );

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
  }

  if (count === 0) return null;

  return (
    <div className={cx("space-y-4", className)}>
      <div
        role="group"
        aria-roledescription="image gallery"
        aria-label={`${current.alt}, image ${index + 1} of ${count}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <div
          className={cx("relative aspect-square overflow-hidden bg-panel", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
          onPointerMove={onPointerMove}
          onClick={() => setZoomed((z) => !z)}
        >
          <div
            className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-lux)]"
            style={{ transform: zoomed ? "scale(2.5)" : "scale(1)", transformOrigin: `${origin.x}% ${origin.y}%` }}
          >
            <Photo key={current.src} src={current.src} alt={current.alt} ratio="aspect-square" zoomOnHover={false} priority={index === 0} sizes="(min-width: 1024px) 55vw, 100vw" />
          </div>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-night/55 text-ivory backdrop-blur-sm transition hover:bg-night/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.25} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-night/55 text-ivory backdrop-blur-sm transition hover:bg-night/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.25} aria-hidden />
            </button>
          </>
        ) : null}

        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            type="button"
            aria-pressed={zoomed}
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
            onClick={() => setZoomed((z) => !z)}
            className="grid h-11 w-11 place-items-center bg-night/55 text-ivory backdrop-blur-sm transition hover:bg-night/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {zoomed ? <ZoomOut className="h-4 w-4" strokeWidth={1.25} aria-hidden /> : <ZoomIn className="h-4 w-4" strokeWidth={1.25} aria-hidden />}
          </button>
          <button
            type="button"
            aria-label="Open full screen view"
            onClick={() => setLightbox(true)}
            className="grid h-11 w-11 place-items-center bg-night/55 text-ivory backdrop-blur-sm transition hover:bg-night/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.25} aria-hidden />
          </button>
        </div>
      </div>

      {count > 1 ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6" aria-label="Choose image">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                aria-label={`Show image ${i + 1}: ${img.alt}`}
                aria-current={index === i ? "true" : undefined}
                onClick={() => go(i)}
                className={cx(
                  "block w-full transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  index === i ? "outline outline-1 outline-offset-2 outline-accent" : "opacity-70 hover:opacity-100",
                )}
              >
                <Photo src={img.src} alt="" ratio="aspect-square" zoomOnHover={false} sizes="120px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal open={lightbox} onClose={() => setLightbox(false)} title={`${current.alt}`} size="full" className="flex h-full max-h-none flex-col border-0 bg-night p-4 sm:p-8">
        <div className="relative flex-1">
          <Photo src={current.src} alt={current.alt} ratio="aspect-square" className="mx-auto h-full max-h-[80vh] w-auto max-w-full" zoomOnHover={false} sizes="100vw" />
        </div>
        {count > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-6 text-ivory">
            <button type="button" aria-label="Previous image" onClick={() => go(index - 1)} className="grid h-11 w-11 place-items-center border border-ivory/30">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.25} aria-hidden />
            </button>
            <p className="text-sm tabular-nums">
              {index + 1} / {count}
            </p>
            <button type="button" aria-label="Next image" onClick={() => go(index + 1)} className="grid h-11 w-11 place-items-center border border-ivory/30">
              <ChevronRight className="h-5 w-5" strokeWidth={1.25} aria-hidden />
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
