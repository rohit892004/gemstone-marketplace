"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Browser tracking. Every call posts to /api/analytics/event with keepalive, so it never blocks rendering or
 * navigation. The server applies the rules (staff, bots, own pages, dedupe, rate limit); a failed post is ignored.
 */

const ENDPOINT = "/api/analytics/event";
const SEARCH_DEBOUNCE_MS = 800;
const IMPRESSION_BATCH = 24;
const IMPRESSION_FLUSH_MS = 1000;

type Body = Record<string, unknown>;

function post(body: Body): void {
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // Tracking must never break the page.
  }
}

/** Records one view when the page (or the component) mounts. */
export function TrackView({ kind, sellerSlug, gemstoneId }: { kind: "PROFILE_VIEW" | "LISTING_VIEW"; sellerSlug?: string; gemstoneId?: string }) {
  useEffect(() => {
    if (kind === "PROFILE_VIEW" && sellerSlug) post({ kind, sellerSlug });
    if (kind === "LISTING_VIEW" && gemstoneId) post({ kind, gemstoneId });
  }, [kind, sellerSlug, gemstoneId]);
  return null;
}

/** Records a real search, once the term has settled. Terms under two characters are not searches. */
export function TrackSearch({ term }: { term: string | null | undefined }) {
  useEffect(() => {
    const cleaned = term?.trim() ?? "";
    if (cleaned.length < 2) return;
    const timer = setTimeout(() => post({ kind: "SEARCH", term: cleaned }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);
  return null;
}

function sendIds(ids: string[]): void {
  for (let i = 0; i < ids.length; i += IMPRESSION_BATCH) {
    post({ kind: "LISTING_IMPRESSION", gemstoneIds: ids.slice(i, i + IMPRESSION_BATCH) });
  }
}

/**
 * Listing impressions. Each element with data-impression-id inside the ref counts once per page view, when at least
 * half of it is on screen. Ids are sent in batches, so a long grid is one or two requests, not one per card.
 */
export function useImpressionTracking(ref: RefObject<HTMLElement | null>): void {
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    let pending: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (pending.length === 0) return;
      const ids = pending;
      pending = [];
      sendIds(ids);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          observer.unobserve(element);
          const id = element.dataset.impressionId;
          if (!id || seen.current.has(id)) continue;
          seen.current.add(id);
          pending.push(id);
        }
        if (pending.length >= IMPRESSION_BATCH) {
          if (timer !== null) clearTimeout(timer);
          flush();
        } else if (pending.length > 0 && timer === null) {
          timer = setTimeout(flush, IMPRESSION_FLUSH_MS);
        }
      },
      { threshold: 0.5 },
    );

    root.querySelectorAll<HTMLElement>("[data-impression-id]").forEach((element) => {
      if (!seen.current.has(element.dataset.impressionId ?? "")) observer.observe(element);
    });

    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      flush();
    };
    // Re-run after each render, so cards that arrived with a new result set are observed too.
  });
}

/** Wraps a grid of listing cards so their impressions are tracked. Renders no box of its own. */
export function ImpressionScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpressionTracking(ref);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
