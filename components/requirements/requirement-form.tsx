"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState, useTransition } from "react";
import { postRequirementAction, updateRequirementAction } from "@/app/buyer/requirements/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { REQUIREMENT_LIMITS, type RequirementField, type RequirementRaw } from "@/lib/requirements/validate";

/**
 * Create and edit form for a buyer requirement. The server validates everything and returns field
 * errors; this component only shows them. Plain text fields only.
 */

export interface RequirementFormProps {
  mode: "create" | "edit";
  requirementId?: string;
  initial: RequirementRaw;
  categories: { id: string; name: string }[];
  /** Existing gemstone types and shapes from the catalogue, offered as suggestions. */
  gemstoneTypeOptions: string[];
  shapeOptions: string[];
  /** Approved sellers posting as buyers return to their own requirement list, not the buyer area. */
  sellerPoster?: boolean;
}

export function RequirementForm(props: RequirementFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequirementField, string>>>({});
  const [saved, setSaved] = useState<{ requirementId: string; warning: string | null } | null>(null);
  const ids = useId();
  const { initial } = props;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await postRequirementAction(data)
          : await updateRequirementAction(props.requirementId ?? "", data);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (result.warning) {
        setSaved({ requirementId: result.requirementId, warning: result.warning });
        return;
      }
      router.push(props.sellerPoster ? "/seller/requirements/mine" : `/buyer/requirements/${result.requirementId}`);
    });
  }

  const cancelHref = props.sellerPoster
    ? "/seller/requirements/mine"
    : props.mode === "create"
      ? "/buyer/requirements"
      : `/buyer/requirements/${props.requirementId}`;

  const err = (name: RequirementField) => fieldErrors[name];
  const id = (name: string) => `${ids}-${name}`;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-8" aria-label={props.mode === "create" ? "Post a requirement" : "Edit requirement"}>
      {error ? (
        <p role="alert" className=" border border-danger/40 bg-surface-raised px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <div role="status" className="space-y-2 border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          <p>{saved.warning}</p>
          <Link href={`/buyer/requirements/${saved.requirementId}`} className="font-medium text-ink underline underline-offset-4 hover:text-accent-text">
            View your requirement
          </Link>
        </div>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">What you are looking for</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <ReqField id={id("gemstoneType")} label="Gemstone type" required error={err("gemstoneType")} hint="For example: Sapphire, Ruby, Emerald">
            <Input
              id={id("gemstoneType")}
              name="gemstoneType"
              list={`${ids}-types`}
              defaultValue={initial.gemstoneType}
              required
              maxLength={REQUIREMENT_LIMITS.gemstoneTypeMax}
              aria-invalid={err("gemstoneType") ? true : undefined}
              
            />
            <datalist id={`${ids}-types`}>
              {props.gemstoneTypeOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </ReqField>

          <ReqField id={id("categoryId")} label="Category" error={err("categoryId")}>
            <Select id={id("categoryId")} name="categoryId" defaultValue={initial.categoryId}  aria-invalid={err("categoryId") ? true : undefined}>
              <option value="">Any category</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </ReqField>

          <ReqField id={id("shape")} label="Shape" error={err("shape")}>
            <Input id={id("shape")} name="shape" list={`${ids}-shapes`} defaultValue={initial.shape} maxLength={60}  aria-invalid={err("shape") ? true : undefined} />
            <datalist id={`${ids}-shapes`}>
              {props.shapeOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </ReqField>

          <ReqField id={id("originPreference")} label="Origin preference" error={err("originPreference")} hint="Optional. For example: Ceylon, Madagascar">
            <Input id={id("originPreference")} name="originPreference" defaultValue={initial.originPreference} maxLength={80}  aria-invalid={err("originPreference") ? true : undefined} />
          </ReqField>

          <ReqField id={id("caratMin")} label="Carat from" error={err("caratMin")} hint="Optional. Up to 3 decimals">
            <Input id={id("caratMin")} name="caratMin" inputMode="decimal" defaultValue={initial.caratMin}  aria-invalid={err("caratMin") ? true : undefined} />
          </ReqField>
          <ReqField id={id("caratMax")} label="Carat to" error={err("caratMax")}>
            <Input id={id("caratMax")} name="caratMax" inputMode="decimal" defaultValue={initial.caratMax}  aria-invalid={err("caratMax") ? true : undefined} />
          </ReqField>

          <ReqField id={id("quantity")} label="Quantity" required error={err("quantity")}>
            <Input id={id("quantity")} name="quantity" type="number" inputMode="numeric" min={1} max={REQUIREMENT_LIMITS.quantityMax} defaultValue={initial.quantity} required  aria-invalid={err("quantity") ? true : undefined} />
          </ReqField>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input name="certificateNeeded" type="checkbox" defaultChecked={initial.certificateNeeded === "on"} className="size-4 accent-brand" />
              Certificate needed
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">Budget and timing</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <ReqField id={id("currency")} label="Currency" error={err("currency")}>
            <Select id={id("currency")} name="currency" defaultValue={initial.currency || "INR"}  aria-invalid={err("currency") ? true : undefined}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </Select>
          </ReqField>
          <div className="hidden sm:block" aria-hidden="true" />
          <ReqField id={id("budgetMin")} label="Budget from" error={err("budgetMin")} hint="Optional. Whole amounts or up to 2 decimals">
            <Input id={id("budgetMin")} name="budgetMin" inputMode="decimal" defaultValue={initial.budgetMin} placeholder="For example 500,000"  aria-invalid={err("budgetMin") ? true : undefined} />
          </ReqField>
          <ReqField id={id("budgetMax")} label="Budget to" error={err("budgetMax")}>
            <Input id={id("budgetMax")} name="budgetMax" inputMode="decimal" defaultValue={initial.budgetMax} placeholder="For example 900,000"  aria-invalid={err("budgetMax") ? true : undefined} />
          </ReqField>
          <ReqField id={id("deadline")} label="Deadline" error={err("deadline")} hint="Optional. Sellers see that you need a reply by this date">
            <Input id={id("deadline")} name="deadline" type="date" defaultValue={initial.deadline}  aria-invalid={err("deadline") ? true : undefined} />
          </ReqField>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-heading text-2xl text-ink">Notes</legend>
        <ReqField id={id("notes")} label="Notes for sellers" error={err("notes")} hint="Describe the stone you need. Phone numbers, emails and social handles are hidden automatically.">
          <Textarea id={id("notes")} name="notes" rows={5} maxLength={REQUIREMENT_LIMITS.notesMax} defaultValue={initial.notes}  aria-invalid={err("notes") ? true : undefined} />
        </ReqField>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : props.mode === "create" ? "Post requirement" : "Save changes"}
        </Button>
        <Link href={cancelHref} className="text-sm text-ink-soft hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ReqField({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field
      id={id}
      label={
        <>
          {label}
          {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        </>
      }
      hint={hint}
      error={error ? <span role="alert">{error}</span> : undefined}
    >
      {children}
    </Field>
  );
}
