import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Photo } from "./photo";

/**
 * Empty state for lists, queues and dashboards. Uses a photograph or a thin line icon. Never an illustration
 * or cartoon. Always gives the person something to do next, via `action`.
 */
export function EmptyState({
  title,
  body,
  icon: Icon,
  photo,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  photo?: { src: string; alt: string };
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("grid gap-8 border border-line bg-surface-raised p-8 text-center sm:p-12", photo && "sm:grid-cols-[minmax(0,240px)_1fr] sm:text-left sm:items-center", className)}>
      {photo ? (
        <Photo src={photo.src} alt={photo.alt} ratio="aspect-[4/3]" className="w-full" zoomOnHover={false} />
      ) : Icon ? (
        <div className="mx-auto grid h-14 w-14 place-items-center border border-line text-accent sm:mx-0">
          <Icon className="h-6 w-6" strokeWidth={1.25} aria-hidden />
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className="font-heading text-2xl text-ink">{title}</h3>
        {body ? <p className="mx-auto max-w-prose text-[15px] leading-relaxed text-ink-soft sm:mx-0">{body}</p> : null}
        {action ? <div className="pt-3">{action}</div> : null}
      </div>
    </div>
  );
}
