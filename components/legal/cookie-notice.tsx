"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Cookie that records the visitor dismissed the notice. Essential, first-party, one year, no personal data. */
export const NOTICE_COOKIE = "gs_notice";
const NOTICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function isDismissed(): boolean {
  return document.cookie.split("; ").some((part) => part.startsWith(`${NOTICE_COOKIE}=`));
}

/**
 * Bottom banner explaining the cookies the site sets. Client-only, so the page stays prerenderable: the
 * banner renders nothing until the browser has checked for the notice cookie, which avoids a flash.
 */
export function CookieNotice() {
  // Server render and first paint treat the notice as dismissed, so nothing shows until the browser says otherwise.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  if (dismissed) return null;

  function dismiss() {
    document.cookie = `${NOTICE_COOKIE}=1; Path=/; Max-Age=${NOTICE_MAX_AGE_SECONDS}; SameSite=Lax`;
    listeners.forEach((callback) => callback());
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised px-4 py-3 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>
          We use essential cookies to keep you signed in. We also set one first-party analytics cookie (gs_vid) that
          holds a random identifier, not personal data, to count visits. See our{" "}
          <Link href="/legal/cookies" className="underline text-brand-strong">cookie notice</Link>.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 self-start inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
