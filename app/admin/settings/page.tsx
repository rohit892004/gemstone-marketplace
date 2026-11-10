import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { getBooleanSetting } from "@/lib/settings/app-settings";
import { saveAutoPublishSetting } from "./actions";

export const metadata = { title: "Platform settings", robots: { index: false, follow: false } };

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requirePageRole(["ADMIN"]);
  const autoPublish = await getBooleanSetting("autoPublishApprovedSellers");

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Business" title="Platform settings" />

      <section className="space-y-6">
        <SectionHeading title="Auto-publish for approved sellers" />
        <p className="text-[15px] text-ink">
          Currently <strong className="font-medium">{autoPublish ? "on" : "off"}</strong>.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
          <li>When on, a listing submitted by an approved seller goes live immediately instead of waiting in the review queue.</li>
          <li>It applies to future submissions only. Turning it on does not publish listings already waiting for review.</li>
          <li>Changes are recorded in the audit log with the old and new value.</li>
        </ul>
        <ActionForm
          action={saveAutoPublishSetting}
          title="Auto-publish approved sellers' listings"
          submitLabel="Save setting"
          fields={[
            {
              name: "autoPublish",
              label: "Publish listings from approved sellers without manual review",
              kind: "checkbox",
              defaultValue: autoPublish ? "on" : "off",
            },
          ]}
        />
      </section>
    </div>
  );
}
