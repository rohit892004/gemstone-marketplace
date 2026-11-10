import type { ReactNode } from "react";
import { Field, Textarea } from "@/components/ui/field";

/** Field helpers for the seller catalogue. M1 field components stay untouched; these add textarea and image inputs. */

interface ShellProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FieldFrame({ name, label, error, hint, required, children }: ShellProps) {
  return (
    <Field
      id={name}
      label={
        <>
          {label}
          {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        </>
      }
      hint={hint ? <span id={`${name}-hint`}>{hint}</span> : undefined}
      error={error ? <span role="alert">{error}</span> : undefined}
    >
      {children}
    </Field>
  );
}

function describedBy(name: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  required,
  defaultValue,
  rows = 4,
  maxLength,
}: Omit<ShellProps, "children"> & { defaultValue?: string; rows?: number; maxLength?: number }) {
  return (
    <FieldFrame name={name} label={label} error={error} hint={hint} required={required}>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        
      />
    </FieldFrame>
  );
}

export function ImageFileField({
  name,
  label,
  error,
  hint,
  multiple,
  accept = "image/jpeg,image/png,image/webp",
}: Omit<ShellProps, "children" | "required"> & { multiple?: boolean; accept?: string }) {
  return (
    <FieldFrame name={name} label={label} error={error} hint={hint}>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className="mt-1 block w-full text-sm text-ink file:mr-3 file: file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
      />
    </FieldFrame>
  );
}

/** Radio group with a visible legend. */
export function RadioGroup({
  name,
  legend,
  options,
  defaultValue,
  error,
}: {
  name: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
