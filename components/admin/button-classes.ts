import { buttonClasses } from "@/components/ui/button";

/** Outlined red button for destructive admin actions. Kept separate from buttonClasses so no two border colours compete. */
export const DANGER_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-danger px-6 py-3 text-sm tracking-wide text-danger transition duration-300 hover:bg-danger/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

/** Button look for an admin form: charcoal for normal actions, outlined red for destructive ones. */
export function adminButtonClass(danger: boolean): string {
  return danger ? DANGER_BUTTON : buttonClasses({});
}
