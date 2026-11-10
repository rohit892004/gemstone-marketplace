import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { loadRequirementBoard } from "@/lib/requirements/board";
import { budgetLabel, caratLabel } from "@/lib/requirements/format";
import { QUOTATION_CURRENCIES } from "@/lib/quotations/validate";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Requirements board. Open requirements in the seller's own categories. No buyer names or contact details
 * are selected or shown. Filters are plain GET parameters, so filtered views can be shared and reloaded.
 */
export default function SellerRequirementsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Requirements" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const raw = await searchParams;
  const data = await loadRequirementBoard(user.id, raw);
  const f = data.filters;

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent-text">Requirements board</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Buyer requirements</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Open requirements in your gemstone categories. Buyer details stay hidden. Respond to start a conversation on the platform.
        </p>
        <p className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/seller/requirements/new" className="font-medium text-brand-strong underline underline-offset-4">
            Post a requirement
          </Link>
          <Link href="/seller/requirements/mine" className="font-medium text-brand-strong underline underline-offset-4">
            Your requirements
          </Link>
        </p>
      </div>

      {data.categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-6 text-sm text-ink-soft">
          Your profile has no gemstone categories yet, so no requirements match. Add categories to your business profile to see requirements.
        </div>
      ) : (
        <form method="get" className="grid gap-3 rounded-lg border border-line bg-surface-raised p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="f-category" label="Category">
            <select id="f-category" name="category" defaultValue={f.categoryId ?? ""} className={inputClass}>
              <option value="">All my categories</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-type" label="Gemstone type">
            <input id="f-type" name="type" defaultValue={f.gemstoneType ?? ""} placeholder="e.g. Sapphire" maxLength={60} className={inputClass} />
          </Field>
          <Field id="f-carat-min" label="Carat from">
            <input id="f-carat-min" name="caratMin" inputMode="decimal" defaultValue={one(raw.caratMin)} className={inputClass} />
          </Field>
          <Field id="f-carat-max" label="Carat to">
            <input id="f-carat-max" name="caratMax" inputMode="decimal" defaultValue={one(raw.caratMax)} className={inputClass} />
          </Field>
          <Field id="f-currency" label="Budget currency">
            <select id="f-currency" name="currency" defaultValue={f.currency} className={inputClass}>
              {QUOTATION_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-budget-min" label="Budget from">
            <input id="f-budget-min" name="budgetMin" inputMode="decimal" defaultValue={one(raw.budgetMin)} className={inputClass} />
          </Field>
          <Field id="f-budget-max" label="Budget to">
            <input id="f-budget-max" name="budgetMax" inputMode="decimal" defaultValue={one(raw.budgetMax)} className={inputClass} />
          </Field>
          <Field id="f-deadline" label="Deadline on or before">
            <input id="f-deadline" name="deadlineBy" type="date" defaultValue={one(raw.deadlineBy)} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2 lg:col-span-2">
            <input type="checkbox" name="certificate" value="yes" defaultChecked={f.certificateNeeded === true} />
            Certificate needed
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">
              Apply filters
            </button>
            <Link href="/seller/requirements" className="text-sm text-brand underline">
              Clear
            </Link>
          </div>
        </form>
      )}

      {data.errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-red-700">
          {data.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {data.categories.length > 0 && data.rows.length === 0 ? (
        <p className="text-ink-soft">No open requirements match these filters right now.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-accent-text">{row.category?.name ?? "Category"}</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {row.gemstoneType}
                    {row.shape ? <span className="font-normal text-ink-soft"> · {row.shape}</span> : null}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.isDemo && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-ink">Demo</span>}
                  {row.responses.length > 0 && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">Responded</span>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-soft">Carat</dt>
                <dd className="text-ink">{caratLabel(row.caratMin?.toString() ?? null, row.caratMax?.toString() ?? null)}</dd>
                <dt className="text-ink-soft">Budget</dt>
                <dd className="text-ink">{budgetLabel(row.budgetMinMinor, row.budgetMaxMinor, row.currency)}</dd>
                <dt className="text-ink-soft">Quantity</dt>
                <dd className="text-ink">{row.quantity}</dd>
                <dt className="text-ink-soft">Certificate</dt>
                <dd className="text-ink">{row.certificateNeeded ? "Needed" : "Not required"}</dd>
                <dt className="text-ink-soft">Deadline</dt>
                <dd className="text-ink">
                  {row.deadline ? row.deadline.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" }) : "No deadline"}
                </dd>
              </dl>
              <div className="mt-auto">
                <Link href={`/seller/requirements/${row.id}`} className="text-sm font-medium text-brand underline">
                  {row.responses.length > 0 ? "View requirement" : "View and respond"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-ink-soft">
        {label}
      </label>
      {children}
    </div>
  );
}

