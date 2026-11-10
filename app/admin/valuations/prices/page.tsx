import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { ValuationForm } from "@/components/valuator/valuation-form";
import { MultiplierEditTable, PriceEditTable, type MultiplierTableRow, type PriceTableRow } from "../_components/price-edit-table";
import { CURRENCIES, CARAT_BANDS, QUALITY_GRADES } from "@/lib/valuation/engine";
import { VALUATION_CATEGORIES } from "@/lib/valuation/defaults";
import { formatBpsAsPercent, MULTIPLIER_KIND_LABELS, MULTIPLIER_KINDS, type MultiplierKind } from "@/lib/valuation/admin-values";
import { loadMultiplierEntries, loadReferencePriceEntries } from "@/lib/valuation/admin-prices";
import { minorToMajorString } from "@/lib/valuation/admin-csv";
import { addMultiplierAction, addPriceRowAction, importPricesAction, saveMultipliersAction, savePricesAction } from "./actions";

export const metadata = { title: "Reference prices" };

export default function ReferencePricesPage() {
  return (
    <Suspense fallback={null}>
      <PricesEditor />
    </Suspense>
  );
}

const DEMO_NOTE = "Demo — indicative";

async function PricesEditor() {
  await requirePageRole(["ADMIN"]);
  const [prices, multipliers] = await Promise.all([loadReferencePriceEntries(), loadMultiplierEntries()]);

  const priceRows: PriceTableRow[] = prices.map((row) => ({
    id: row.id,
    gemstoneType: row.gemstoneType,
    currency: row.currency,
    qualityGrade: row.qualityGrade,
    band: row.band,
    priceMajor: minorToMajorString(row.pricePerCaratMinor),
    isDemo: row.isDemo,
    updatedAt: row.updatedAt.toISOString(),
  }));
  const demoCount = prices.filter((p) => p.isDemo).length + multipliers.filter((m) => m.isDemo).length;

  const multiplierRows: MultiplierTableRow[] = multipliers.map((row) => ({
    id: row.id,
    kind: row.kind,
    kindLabel: MULTIPLIER_KIND_LABELS[row.kind as MultiplierKind] ?? row.kind,
    key: row.key,
    label: row.label,
    percent: formatBpsAsPercent(row.bps),
    isDemo: row.isDemo,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Reference prices</h1>
        <p className="text-sm text-stone-600">
          These prices drive the automatic estimate. Rows marked <span className="font-medium">{DEMO_NOTE}</span> are placeholders,
          not market prices. Saving a row makes it real data.
        </p>
        {demoCount > 0 ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            {demoCount} row{demoCount === 1 ? " is" : "s are"} still demo data.
          </p>
        ) : null}
        <p className="text-sm">
          <a href="/admin/valuations/prices/export" className="underline" download>
            Download all prices as CSV
          </a>
        </p>
      </div>

      <section aria-labelledby="prices-heading" className="space-y-3">
        <h2 id="prices-heading" className="text-lg font-medium">Price per carat</h2>
        {priceRows.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No price rows yet. Import a CSV or add one below.</p>
        ) : (
          <PriceEditTable action={savePricesAction} rows={priceRows} />
        )}
      </section>

      <section aria-labelledby="add-price-heading" className="space-y-3">
        <h2 id="add-price-heading" className="text-lg font-medium">Add or replace one price</h2>
        <ValuationForm
          title="Add a price row"
          description="If a row already exists for this type, currency, grade and band, its price is replaced."
          action={addPriceRowAction}
          submitLabel="Save price"
          fields={[
            { name: "gemstoneType", label: "Gemstone type", kind: "select", required: true, options: VALUATION_CATEGORIES.map((c) => ({ value: c, label: c })) },
            { name: "currency", label: "Currency", kind: "select", required: true, options: CURRENCIES.map((c) => ({ value: c, label: c })) },
            { name: "qualityGrade", label: "Quality grade", kind: "select", required: true, options: QUALITY_GRADES.map((g) => ({ value: g, label: g })) },
            { name: "band", label: "Carat band", kind: "select", required: true, options: CARAT_BANDS.map((b) => ({ value: b.key, label: b.label })) },
            { name: "priceMajor", label: "Price per carat (major units)", required: true, inputMode: "decimal", help: "Such as 50000.00." },
          ]}
        />
      </section>

      <section aria-labelledby="import-heading" className="space-y-3">
        <h2 id="import-heading" className="text-lg font-medium">Import a CSV</h2>
        <p className="text-sm text-stone-600">
          Header row, exactly: <code className="break-all font-mono">gemstone_type,currency,quality_grade,carat_band,price_per_carat</code>. The import is
          all or nothing: if any row is wrong, nothing is written and every problem is listed with its line number.
        </p>
        <ValuationForm
          title="Upload prices"
          action={importPricesAction}
          submitLabel="Import CSV"
          fields={[{ name: "file", label: "CSV file", kind: "file", accept: ".csv,text/csv", required: true, help: "Up to 1 MB." }]}
        />
      </section>

      <section aria-labelledby="multipliers-heading" className="space-y-3">
        <h2 id="multipliers-heading" className="text-lg font-medium">Multipliers</h2>
        <p className="text-sm text-stone-600">
          Each multiplier is a percentage of the base price. 100 means no change, 85 means 15% lower. Stored in basis points.
        </p>
        {multiplierRows.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No multipliers yet.</p>
        ) : (
          <MultiplierEditTable action={saveMultipliersAction} rows={multiplierRows} />
        )}
        <ValuationForm
          title="Add a multiplier"
          action={addMultiplierAction}
          submitLabel="Add multiplier"
          fields={[
            { name: "kind", label: "Type", kind: "select", required: true, options: MULTIPLIER_KINDS.map((k) => ({ value: k, label: MULTIPLIER_KIND_LABELS[k] })) },
            { name: "key", label: "Key", required: true, maxLength: 60, help: "Lower case, as the requester would type it, such as south africa." },
            { name: "label", label: "Label", required: true, maxLength: 80, help: "Shown to admins, such as South Africa." },
            { name: "percent", label: "Percent of base", required: true, inputMode: "decimal", help: "Such as 90 or 92.5." },
          ]}
        />
      </section>
    </div>
  );
}
