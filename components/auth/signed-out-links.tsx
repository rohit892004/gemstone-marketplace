import Link from "next/link";

/** Log in / Join links. Also the Suspense fallback for the header, so the static shell is usable. */
export function SignedOutLinks() {
  return (
    <>
      <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong"
      >
        Join
      </Link>
    </>
  );
}
