"use client";

import { useActionState, useId, useState } from "react";
import { saveDetailsAction } from "@/app/valuation/actions";
import { QUALITY_GRADE_LABELS, QUALITY_GRADES } from "@/lib/valuation/engine";
import { NOTES_LIMIT, notesCountLabel, type FormErrorField } from "@/lib/valuation/requester-form";
import { ErrorSummary, Field, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export interface DetailsInitial {
  gemstoneType: string;
  categoryId: string;
  shape: string;
  carat: string;
  dimensions: string;
  colour: string;
  clarity: string;
  qualityGrade: string;
  origin: string;
  treatment: string;
  labId: string;
  certificateNumber: string;
  notes: string;
  currency: string;
}

export interface DetailsFormProps {
  valuationId: string;
  initial: DetailsInitial;
  gemstoneTypeOptions: readonly string[];
  categories: { id: string; name: string }[];
  labs: { id: string; name: string }[];
  /** Where "Continue" goes. Chosen on the server from the valuation's status. */
  continueTo: string;
  continueLabel: string;
  /** Shown when the details were copied from a listing. */
  fromListing: boolean;
}

/**
 * Step 1 details. The server validates everything (parseValuationDetails) and returns one message. That message is
 * shown in the summary and, where it names a field, beside that field.
 */
export function DetailsForm(props: DetailsFormProps) {
  const { initial } = props;
  const [state, formAction, pending] = useActionState(saveDetailsAction, null);
  const [notesLength, setNotesLength] = useState(initial.notes.length);
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  const fieldError = (name: FormErrorField) => (state && !state.ok && state.field === name ? state.error : undefined);
  const summary = state && !state.ok ? [state.error] : [];
  const notesOver = notesLength > NOTES_LIMIT;

  const gradeOptions = QUALITY_GRADES;
  const typeOptions = props.gemstoneTypeOptions.includes(initial.gemstoneType) || !initial.gemstoneType
    ? props.gemstoneTypeOptions
    : [initial.gemstoneType, ...props.gemstoneTypeOptions];

  return (
    <form action={formAction} noValidate className="space-y-8" aria-label="Gemstone details">
      <input type="hidden" name="valuationId" value={props.valuationId} />
      <input type="hidden" name="continueTo" value={props.continueTo} />

      {props.fromListing ? (
        <p className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          These details and photos were copied from the listing. Check them, and change anything that is not right for this request.
        </p>
      ) : null}

      <ErrorSummary messages={summary} />
      {state && state.ok && state.message ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Stone details</legend>

        <Field id={id("gemstoneType")} label="Gemstone type" required error={fieldError("gemstoneType")}>
          <select id={id("gemstoneType")} name="gemstoneType" defaultValue={initial.gemstoneType} required className={inputClass} aria-invalid={fieldError("gemstoneType") ? true : undefined}>
            <option value="">Choose a type</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id("categoryId")} label="Category" error={fieldError("categoryId")}>
          <select id={id("categoryId")} name="categoryId" defaultValue={initial.categoryId} className={inputClass} aria-invalid={fieldError("categoryId") ? true : undefined}>
            <option value="">Not sure</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id("carat")} label="Carat weight" required error={fieldError("carat")} hint="For example 1.25. Up to three decimals.">
          <input id={id("carat")} name="carat" inputMode="decimal" defaultValue={initial.carat} required className={inputClass} aria-invalid={fieldError("carat") ? true : undefined} />
        </Field>

        <Field id={id("shape")} label="Shape or cut" error={fieldError("shape")}>
          <input id={id("shape")} name="shape" defaultValue={initial.shape} maxLength={60} className={inputClass} aria-invalid={fieldError("shape") ? true : undefined} />
        </Field>

        <Field id={id("dimensions")} label="Dimensions" error={fieldError("dimensions")} hint="For example 7.2 x 5.1 x 3.4 mm">
          <input id={id("dimensions")} name="dimensions" defaultValue={initial.dimensions} maxLength={120} className={inputClass} aria-invalid={fieldError("dimensions") ? true : undefined} />
        </Field>

        <Field id={id("colour")} label="Colour" error={fieldError("colour")}>
          <input id={id("colour")} name="colour" defaultValue={initial.colour} maxLength={120} className={inputClass} aria-invalid={fieldError("colour") ? true : undefined} />
        </Field>

        <Field id={id("clarity")} label="Clarity" error={fieldError("clarity")}>
          <input id={id("clarity")} name="clarity" defaultValue={initial.clarity} maxLength={120} className={inputClass} aria-invalid={fieldError("clarity") ? true : undefined} />
        </Field>

        <Field id={id("qualityGrade")} label="Overall quality" error={fieldError("qualityGrade")} hint="Choose the closest match, or leave blank if you do not know.">
          <select id={id("qualityGrade")} name="qualityGrade" defaultValue={initial.qualityGrade} className={inputClass} aria-invalid={fieldError("qualityGrade") ? true : undefined}>
            <option value="">Not sure</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {QUALITY_GRADE_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id("origin")} label="Origin" error={fieldError("origin")} hint="For example Ceylon, Madagascar or Burma">
          <input id={id("origin")} name="origin" defaultValue={initial.origin} maxLength={120} className={inputClass} aria-invalid={fieldError("origin") ? true : undefined} />
        </Field>

        <Field id={id("treatment")} label="Treatment" error={fieldError("treatment")} hint="For example none, heat or oil">
          <input id={id("treatment")} name="treatment" defaultValue={initial.treatment} maxLength={120} className={inputClass} aria-invalid={fieldError("treatment") ? true : undefined} />
        </Field>

        <Field id={id("labId")} label="Certificate lab" error={fieldError("labId")}>
          <select id={id("labId")} name="labId" defaultValue={initial.labId} className={inputClass} aria-invalid={fieldError("labId") ? true : undefined}>
            <option value="">No certificate</option>
            {props.labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id("certificateNumber")} label="Certificate number" error={fieldError("certificateNumber")}>
          <input id={id("certificateNumber")} name="certificateNumber" defaultValue={initial.certificateNumber} maxLength={80} className={inputClass} aria-invalid={fieldError("certificateNumber") ? true : undefined} />
        </Field>

        <Field id={id("currency")} label="Currency" required error={fieldError("currency")} hint="The estimate is shown in this currency.">
          <select id={id("currency")} name="currency" defaultValue={initial.currency} required className={inputClass} aria-invalid={fieldError("currency") ? true : undefined}>
            <option value="INR">INR (Indian rupee)</option>
            <option value="USD">USD (US dollar)</option>
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field id={id("notes")} label="Notes" error={fieldError("notes")} hint="Anything else the valuer should know. Do not include phone numbers, email addresses or links.">
            <textarea
              id={id("notes")}
              name="notes"
              rows={4}
              maxLength={NOTES_LIMIT}
              defaultValue={initial.notes}
              onChange={(e) => setNotesLength(e.currentTarget.value.length)}
              aria-invalid={fieldError("notes") || notesOver ? true : undefined}
              aria-describedby={`${id("notes")}-count`}
              className={inputClass}
            />
          </Field>
          <p id={`${id("notes")}-count`} className={`mt-1 text-xs ${notesOver ? "text-red-700" : "text-ink-soft"}`}>
            {notesCountLabel(notesLength)}
          </p>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="submit" disabled={pending || notesOver} className={secondaryButtonClass}>
          {pending ? "Saving..." : "Save draft"}
        </button>
        <button type="submit" name="intent" value="continue" disabled={pending || notesOver} className={primaryButtonClass}>
          {props.continueLabel}
        </button>
      </div>
    </form>
  );
}
