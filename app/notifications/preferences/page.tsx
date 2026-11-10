import Link from "next/link";
import { Suspense } from "react";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { requirePageRole } from "@/lib/auth/require-role";
import { getNotificationPrefs } from "@/lib/notifications/service";

export const metadata = { title: "Notification preferences", robots: { index: false, follow: false } };

export default function NotificationPreferencesPage() {
  return (
    <Suspense fallback={null}>
      <Preferences />
    </Suspense>
  );
}

async function Preferences() {
  const user = await requirePageRole(["BUYER", "SELLER"]);
  const prefs = await getNotificationPrefs(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-10 sm:px-6 lg:py-14">
      <div className="space-y-3">
        <Link href="/notifications" className="inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          Back to notifications
        </Link>
        <h1 className="font-heading text-4xl text-ink sm:text-5xl">Notification preferences</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The bell and the notification centre always show everything. These settings only control email.
        </p>
      </div>
      <PreferencesForm prefs={prefs} />
    </div>
  );
}
