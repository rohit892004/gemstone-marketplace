import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge, DemoTag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";
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
    <div className="space-y-10">
      <div className="space-y-4">
        <PageHeader
          eyebrow="Requirements board"
          title="Buyer requirements"
          lead={
            <>
              Open requirements in your gemstone categories. Buyer details stay hidden. Respond to start a conversation on the platform.
            </>
          }
          actions={
            <>
              <ButtonLink href="/seller/requirements/new" variant="gold">
                Post a requirement
              </ButtonLink>
              <ButtonLink href="/seller/requirements/mine" variant="secondary">
                Your requirements
              </ButtonLink>
            </>
          }
        />
      </div>

      {data.categories.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No gemstone categories yet"
          body="Your profile has no gemstone categories yet, so no requirements match. Add categories to your business profile to see requirements."
          action={
            <ButtonLink href="/seller/portfolio" variant="secondary">
              Edit your business profile
            </ButtonLink>
          }
        />
      ) : (
        <form method="get" className="grid gap-5 border border-line bg-surface-raised p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <Field id="f-category" label="Category">
            <Select id="f-category" name="category" defaultValue={f.categoryId ?? ""}>
              <option value="">All my categories</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="f-type" label="Gemstone type">
            <Input id="f-type" name="type" defaultValue={f.gemstoneType ?? ""} placeholder="e.g. Sapphire" maxLength={60} />
          </Field>
          <Field id="f-carat-min" label="Carat from">
            <Input id="f-carat-min" name="caratMin" inputMode="decimal" defaultValue={one(raw.caratMin)} />
          </Field>
          <Field id="f-carat-max" label="Carat to">
            <Input id="f-carat-max" name="caratMax" inputMode="decimal" defaultValue={one(raw.caratMax)} />
          </Field>
          <Field id="f-currency" label="Budget currency">
            <Select id="f-currency" name="currency" defaultValue={f.currency}>
              {QUOTATION_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="f-budget-min" label="Budget from">
            <Input id="f-budget-min" name="budgetMin" inputMode="decimal" defaultValue={one(raw.budgetMin)} />
          </Field>
          <Field id="f-budget-max" label="Budget to">
            <Input id="f-budget-max" name="budgetMax" inputMode="decimal" defaultValue={one(raw.budgetMax)} />
          </Field>
          <Field id="f-deadline" label="Deadline on or before">
            <Input id="f-deadline" name="deadlineBy" type="date" defaultValue={one(raw.deadlineBy)} />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink sm:col-span-2 lg:col-span-2">
            <input type="checkbox" name="certificate" value="yes" defaultChecked={f.certificateNeeded === true} className="h-5 w-5" />
            Certificate needed
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit">Apply filters</Button>
            <Link href="/seller/requirements" className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4">
              Clear
            </Link>
          </div>
        </form>
      )}

      {data.errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-danger">
          {data.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {data.categories.length > 0 && data.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No open requirements match these filters"
          body="Clear the filters to see every open requirement in your categories."
          action={
            <ButtonLink href="/seller/requirements" variant="secondary">
              Clear filters
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {data.rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-4 bg-surface-raised p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-accent-text">{row.category?.name ?? "Category"}</p>
                  <h2 className="mt-2 font-heading text-2xl text-ink">
                    {row.gemstoneType}
                    {row.shape ? <span className="font-normal text-ink-soft"> · {row.shape}</span> : null}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.isDemo && <DemoTag />}
                  {row.responses.length > 0 && <Badge tone="success">Responded</Badge>}
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
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
                <Link href={`/seller/requirements/${row.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-text">
                  {row.responses.length > 0 ? "View requirement" : "View and respond"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

