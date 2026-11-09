"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 60_000;

/**
 * Header bell with the unread count. Renders nothing for signed-out visitors (the count request
 * returns 401/403) and stops polling after that. Links to the notification centre.
 */
export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function load() {
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        if (stopped) return;
        if (!res.ok) {
          // Not signed in (or not a buyer or seller): no bell, and no further polling.
          setCount(null);
          stopped = true;
          return;
        }
        const body = (await res.json()) as { count?: unknown };
        if (typeof body.count === "number") setCount(body.count);
      } catch {
        // Network blip: keep the last known count and try again on the next tick.
      }
      if (!stopped) timer = setTimeout(load, POLL_MS);
    }

    void load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (count === null) return null;

  const label = count === 0 ? "Notifications" : `Notifications, ${count} unread`;
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-brand px-1.5 text-center text-xs font-semibold leading-5 text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
