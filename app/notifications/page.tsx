import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { isSafeHref } from "@/lib/notifications/rules";
import { markRead } from "./actions";

export const metadata = { title: "Notifications", robots: { index: false, follow: false } };

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationCentre />
    </Suspense>
  );
}

const PAGE_SIZE = 50;

interface ViewItem {
  id: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
  createdAt: Date;
}

/** Reads the stored payload defensively. Only fixed template text is ever stored here. */
function readPayload(payload: unknown): Pick<ViewItem, "title" | "body" | "href"> {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    title: typeof p.title === "string" ? p.title : "Notification",
    body: typeof p.body === "string" ? p.body : "",
    href: typeof p.href === "string" && isSafeHref(p.href) ? p.href : "/notifications",
  };
}

const whenFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

async function NotificationCentre() {
  const user = await requirePageRole(["BUYER", "SELLER"]);

  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: { id: true, payload: true, readAt: true, createdAt: true },
  });
  const items: ViewItem[] = rows.map((row) => ({
    id: row.id,
    ...readPayload(row.payload),
    unread: row.readAt === null,
    createdAt: row.createdAt,
  }));
  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {unreadCount === 0 ? "You're all caught up." : `${unreadCount} unread`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications/preferences"
            className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-accent-soft"
          >
            Preferences
          </Link>
          {unreadCount > 0 ? (
            <form action={markRead}>
              <button
                type="submit"
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong"
              >
                Mark all as read
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-soft">
          No notifications yet. Enquiries, messages, offers, quotations and requirement matches appear here.
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex gap-3 px-4 py-4 hover:bg-accent-soft sm:px-5">
                <span
                  aria-hidden="true"
                  className={`mt-2 h-2 w-2 flex-none rounded-full ${item.unread ? "bg-brand" : "bg-transparent"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${item.unread ? "font-semibold text-ink" : "font-medium text-ink-soft"}`}>
                    {item.title}
                  </span>
                  {item.body ? <span className="mt-0.5 block text-sm text-ink-soft">{item.body}</span> : null}
                  <time dateTime={item.createdAt.toISOString()} className="mt-1 block text-xs text-ink-soft">
                    {whenFormat.format(item.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length === PAGE_SIZE ? (
        <p className="text-xs text-ink-soft">Showing the latest {PAGE_SIZE} notifications.</p>
      ) : null}
    </div>
  );
}
