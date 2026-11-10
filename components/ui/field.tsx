import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

const control =
  "block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink placeholder:text-ink-soft/70 " +
  "transition duration-300 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

/** Label, optional hint and error text around any control. The control gets its id from `id`. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-2", className)}>
      <label htmlFor={id} className="block text-[13px] tracking-wide text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-[12px] text-ink-soft">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-28 resize-y", className)} {...rest} />;
}

/** Native select: keeps the platform picker on phones and works without JavaScript. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, "appearance-none pr-10", className)} {...rest}>
      {children}
    </select>
  );
}
