"use client";

import { useActionState, useId } from "react";
import type { ValuationActionState } from "@/lib/valuation/form-state";

/**
 * Editable tables for the reference price rows and the multipliers. One form saves every changed value, so the
 * page stays usable on a phone. Each input has a visible label, and errors show beside the row and in a summary.
 */

export interface PriceTableRow {
  id: string;
  gemstoneType: string;
  currency: string;
  qualityGrade: string;
  band: string;
  priceMajor: string;
  isDemo: boolean;
  updatedAt: string;
}

export interface MultiplierTableRow {
  id: string;
  kind: string;
  kindLabel: string;
  key: string;
  label: string;
  percent: string;
  isDemo: boolean;
}

type Action = (prev: ValuationActionState, formData: FormData) => Promise<ValuationActionState>;

function Summary({ state }: { state: ValuationActionState }) {
  if (!state || state.ok) return null;
  const items = [state.error, ...(state.errors ?? []), ...Object.values(state.fieldErrors ?? {})].filter(Boolean);
  return (
    <div role="alert" tabIndex={-1} className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">Please fix the following:</p>
      <ul className="list-disc pl-5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ state }: { state: ValuationActionState }) {
  if (!state || !state.ok) return null;
  return (
    <p role="status" className="text-sm text-green-800">
      {state.message}
    </p>
  );
}

const DEMO_TEXT = "Demo — indicative";

export function PriceEditTable({ action, rows, submitLabel = "Save changed prices" }: { action: Action; rows: PriceTableRow[]; submitLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formId = useId();
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={formAction} className="space-y-3">
      <Summary state={state} />
      <Notice state={state} />
      <div className="overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Reference prices per carat</caption>
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th scope="col" className="px-3 py-2">Gemstone</th>
              <th scope="col" className="px-3 py-2">Currency</th>
              <th scope="col" className="px-3 py-2">Grade</th>
              <th scope="col" className="px-3 py-2">Carat band</th>
              <th scope="col" className="px-3 py-2">Price per carat (major units)</th>
              <th scope="col" className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inputId = `${formId}-price-${row.id}`;
              const error = fieldErrors[row.id];
              return (
                <tr key={row.id} className="border-t border-stone-200 align-top">
                  <td className="px-3 py-2">{row.gemstoneType}</td>
                  <td className="px-3 py-2">{row.currency}</td>
                  <td className="px-3 py-2">{row.qualityGrade}</td>
                  <td className="px-3 py-2">{row.band}</td>
                  <td className="px-3 py-2">
                    <label htmlFor={inputId} className="sr-only">
                      Price per carat for {row.gemstoneType}, {row.currency}, {row.qualityGrade}, {row.band}
                    </label>
                    <input
                      id={inputId}
                      name={`price:${row.id}`}
                      defaultValue={row.priceMajor}
                      inputMode="decimal"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      className="w-32 rounded border border-stone-300 p-1.5"
                    />
                    {error ? (
                      <p id={`${inputId}-error`} className="mt-1 text-xs text-red-700">
                        {error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {row.isDemo ? (
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{DEMO_TEXT}</span>
                    ) : (
                      <span className="text-xs text-stone-600">Set by admin</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={pending} className="min-h-11 rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

export function MultiplierEditTable({ action, rows }: { action: Action; rows: MultiplierTableRow[] }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formId = useId();
  return (
    <form action={formAction} className="space-y-3">
      <Summary state={state} />
      <Notice state={state} />
      <div className="overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Multipliers as percentages of the base price</caption>
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Key</th>
              <th scope="col" className="px-3 py-2">Label</th>
              <th scope="col" className="px-3 py-2">Percent of base</th>
              <th scope="col" className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inputId = `${formId}-pct-${row.id}`;
              return (
                <tr key={row.id} className="border-t border-stone-200">
                  <td className="px-3 py-2">{row.kindLabel}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.key}</td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">
                    <label htmlFor={inputId} className="sr-only">
                      Percent for {row.label}
                    </label>
                    <input id={inputId} name={`pct:${row.id}`} defaultValue={row.percent} inputMode="decimal" className="w-24 rounded border border-stone-300 p-1.5" />
                    <span aria-hidden="true"> %</span>
                  </td>
                  <td className="px-3 py-2">
                    {row.isDemo ? (
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{DEMO_TEXT}</span>
                    ) : (
                      <span className="text-xs text-stone-600">Set by admin</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={pending} className="min-h-11 rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving..." : "Save multipliers"}
      </button>
    </form>
  );
}
