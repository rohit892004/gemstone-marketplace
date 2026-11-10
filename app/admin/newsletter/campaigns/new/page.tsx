import { requirePageRole } from "@/lib/auth/require-role";
import { NewsletterNav } from "../../nav";
import { CampaignForm } from "../../campaign-form";
import { createCampaignAction } from "../../actions";

export const metadata = { title: "New newsletter campaign", robots: { index: false, follow: false } };

export default async function NewCampaignPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <NewsletterNav />
      <p className="max-w-2xl text-sm text-stone-700">
        Saved as a draft. You can preview the rendered message, send yourself a test, then schedule it on the campaign page.
      </p>
      <CampaignForm action={createCampaignAction} defaults={{}} submitLabel="Save draft" />
    </div>
  );
}
