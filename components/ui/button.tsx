import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "gold";
export type ButtonSize = "md" | "lg";

/**
 * Button look. Use `buttonClasses` on a Link or anchor so links and buttons share one style.
 * Primary is charcoal, secondary is an outline, gold is for the one key action on a page.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}): string {
  return cx(
    "inline-flex items-center justify-center gap-2 font-sans tracking-wide transition duration-300 ease-[var(--ease-lux)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "px-6 py-3 text-sm" : "px-8 py-4 text-sm",
    variant === "primary" && "bg-brand text-ivory hover:bg-[#2e2b26]",
    variant === "secondary" && "border border-brand text-brand hover:bg-brand/5",
    variant === "ghost" && "text-ink hover:text-accent-text underline-offset-4 hover:underline",
    variant === "gold" && "bg-champagne text-brand-strong hover:bg-[#e6d3a8]",
    block && "w-full",
    className,
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; children: ReactNode }) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  block,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })}>
      {children}
    </Link>
  );
}
