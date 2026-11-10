import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requirePageRole } from "@/lib/auth/require-role";

/** Admin pages are never indexed. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * Admin shell. The session check lives in an async child inside <Suspense>
 * (Cache Components pattern), so the layout's static parts can still prerender.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await requirePageRole(["ADMIN"]);

  return (
    // Stacked on phones (nav scroller above content), two columns from lg up.
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-12">
      <aside className="min-w-0 space-y-6">
        <div className="space-y-1 border-b border-line pb-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent-text">Admin</p>
          <p className="truncate text-sm text-ink-soft">{admin.email}</p>
        </div>
        <AdminNav label="Admin" />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
