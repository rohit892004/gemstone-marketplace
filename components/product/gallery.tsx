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
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-line bg-accent-soft text-sm text-ink-soft">
        No photos yet
      </div>
    );
  }

  const active = items[activeIndex] ?? items[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-accent-soft">
        {active.type === "VIDEO" ? (
          <video
            key={active.id}
            controls
            preload="none"
            src={mediaUrl(active.id, "full")}
            className="size-full bg-black object-contain"
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
            className="object-contain"
          />
        )}
      </div>

      {items.length > 1 ? (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-pressed={i === activeIndex}
                aria-label={`Show ${item.type === "VIDEO" ? "video" : "photo"} ${i + 1}`}
                className={`relative block aspect-square w-full overflow-hidden rounded-md border bg-accent-soft ${
                  i === activeIndex ? "border-brand-strong" : "border-line"
                }`}
              >
                {item.type === "VIDEO" ? (
                  <span className="flex size-full items-center justify-center text-xs font-medium text-ink-soft">Video</span>
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
