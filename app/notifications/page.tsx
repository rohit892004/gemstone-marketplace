import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:py-14">
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        lead={unreadCount === 0 ? "You're all caught up." : `${unreadCount} unread`}
        actions={
          <>
            <ButtonLink href="/notifications/preferences" variant="secondary">
              Preferences
            </ButtonLink>
            {unreadCount > 0 ? (
              <form action={markRead}>
                <Button type="submit" variant="primary">
                  Mark all as read
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          body="Enquiries, messages, offers, quotations and requirement matches appear here."
          action={
            <ButtonLink href="/notifications/preferences" variant="secondary">
              Choose what you hear about
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden border border-line bg-surface-raised">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex gap-4 px-4 py-5 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-6"
              >
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {item.unread ? <Badge tone="accent">New</Badge> : null}
                    <span className={`font-heading text-xl ${item.unread ? "text-ink" : "text-ink-soft"}`}>{item.title}</span>
                  </span>
                  {item.body ? <span className="block text-sm leading-relaxed text-ink-soft">{item.body}</span> : null}
                  <time dateTime={item.createdAt.toISOString()} className="block text-xs text-ink-soft">
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
