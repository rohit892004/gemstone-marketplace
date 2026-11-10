import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Field, Input, Select } from "@/components/ui/field";

/** Labelled text input with an optional hint and an inline error. Server-safe (no hooks), usable inside client forms. */
export function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  autoComplete,
  hint,
  inputMode,
  placeholder,
  required = true,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  defaultValue?: string;
  error?: string;
  autoComplete?: string;
  hint?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  placeholder?: string;
  required?: boolean;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <Field id={name} label={label} error={error}>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={type === "password" ? undefined : defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
      />
      {hint ? (
        <p id={hintId} className="text-[12px] text-ink-soft">
          {hint}
        </p>
      ) : null}
    </Field>
  );
}

/** Native select for short, fixed lists (e.g. country). Keeps the platform picker on phones. */
export function SelectField({
  name,
  label,
  options,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue?: string;
  error?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <Field id={name} label={label} error={error}>
      <div className="relative">
        <Select
          id={name}
          name={name}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.25} aria-hidden />
      </div>
    </Field>
  );
}

/** Status or error message. Errors use role="alert"; other notices use role="status". */
export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger/40 bg-surface-raised text-danger",
    success: "border-success/40 bg-surface-raised text-ink",
    info: "border-line bg-accent-soft text-ink",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("border px-4 py-3 text-[14px] leading-relaxed", styles[tone])}>
      {children}
    </div>
  );
}
