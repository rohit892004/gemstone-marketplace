import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { ValuationForm } from "@/components/valuator/valuation-form";
import { loadThresholdSettings } from "@/lib/valuation/admin-settings";
import { minorToMajorString } from "@/lib/valuation/admin-csv";
import { saveThresholdsAction } from "./actions";

export const metadata = { title: "Expert threshold" };

export default function ExpertThresholdPage() {
  return (
    <Suspense fallback={null}>
      <ThresholdForm />
    </Suspense>
  );
}

async function ThresholdForm() {
  await requirePageRole(["ADMIN"]);
  const settings = await loadThresholdSettings();
  const toText = (minor: bigint | null) => (minor === null ? "" : minorToMajorString(minor));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-4xl font-medium text-ink">Expert threshold</h1>
        <p className="text-sm text-ink-soft">
          A request whose automatic estimate is above this amount goes to a valuer. Blank means no threshold. A category
          override replaces the global value for that gemstone; a blank override inherits the global value.
        </p>
      </div>
      <ValuationForm
        title="Thresholds"
        action={saveThresholdsAction}
        submitLabel="Save thresholds"
        fields={[
          {
            name: "global",
            label: "Global threshold (INR or USD, major units)",
            help: "Blank for none. Amounts are compared in the request's own currency.",
            defaultValue: toText(settings.global),
            inputMode: "decimal",
          },
          ...settings.categories.map((category) => ({
            name: `override:${category.id}`,
            label: `${category.name} override`,
            help: "Blank inherits the global value.",
            defaultValue: toText(category.override),
            inputMode: "decimal" as const,
          })),
        ]}
      />
    </div>
  );
}
