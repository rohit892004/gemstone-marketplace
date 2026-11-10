"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
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
      className="relative inline-flex h-11 w-11 items-center justify-center text-ink-soft transition duration-300 hover:bg-accent-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Bell className="h-5 w-5" strokeWidth={1.25} aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-5 bg-brand px-1.5 text-center text-[11px] font-medium leading-5 tabular-nums text-ivory"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
