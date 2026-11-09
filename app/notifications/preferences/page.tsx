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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/notifications" className="text-sm text-ink-soft hover:text-ink">
          Back to notifications
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Notification preferences</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The bell and the notification centre always show everything. These settings only control email.
        </p>
      </div>
      <PreferencesForm prefs={prefs} />
    </div>
  );
}
