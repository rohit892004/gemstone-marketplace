"use client";

import Image from "next/image";
import { useState } from "react";
import { mediaUrl } from "@/lib/media/urls";

export interface GalleryItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  alt: string | null;
}

/**
 * Cover shown large, thumbnails below. Images use the full variant for the main view and the
 * thumb variant for the strip (lazy-loaded). Videos use a native player with preload="none".
 */
export function ProductGallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) {
    return <div role="img" aria-label={`No photos yet for ${title}`} className="aspect-square bg-panel" />;
  }

  const active = items[activeIndex] ?? items[0];

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden bg-panel">
        {active.type === "VIDEO" ? (
          <video
            key={active.id}
            controls
            preload="none"
            src={mediaUrl(active.id, "full")}
            className="size-full bg-night object-contain"
            aria-label={`${title} video`}
          />
        ) : (
          <Image
            key={active.id}
            src={mediaUrl(active.id, "full")}
            alt={active.alt ?? title}
            fill
            priority
            unoptimized
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>

      {items.length > 1 ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-pressed={i === activeIndex}
                aria-label={`Show ${item.type === "VIDEO" ? "video" : "photo"} ${i + 1}`}
                className={`relative block aspect-square w-full overflow-hidden bg-panel transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  i === activeIndex ? "outline outline-1 outline-offset-2 outline-accent" : "opacity-70 hover:opacity-100"
                }`}
              >
                {item.type === "VIDEO" ? (
                  <span className="flex size-full items-center justify-center text-[11px] uppercase tracking-wider text-ink-soft">Video</span>
                ) : (
                  <Image
                    src={mediaUrl(item.id, "thumb")}
                    alt=""
                    fill
                    loading="lazy"
                    unoptimized
                    sizes="120px"
                    className="object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
