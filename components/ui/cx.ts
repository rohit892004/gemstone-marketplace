/** Joins class names, skipping falsy values. Keeps component files free of template-string noise. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
