import Link from "next/link";

/** Log in / Join links. Also the Suspense fallback for the header, so the static shell is usable. */
export function SignedOutLinks() {
  return (
    <>
      <Link href="/login" className="px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
        Log in
      </Link>
      <Link
        href="/register"
        className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Join
      </Link>
    </>
  );
}
