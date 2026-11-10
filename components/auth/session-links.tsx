import Link from "next/link";
import { logout } from "@/app/logout/actions";
import { auth } from "@/lib/auth/auth";
import { SignedOutLinks } from "./signed-out-links";

/**
 * Header account controls. Reads the session, so it must render inside a <Suspense> boundary
 * (see SiteHeader). Uses the cheap JWT session here; access control is still enforced by requireRole.
 */
export async function SessionLinks() {
  const session = await auth();
  if (!session?.user) return <SignedOutLinks />;

  return (
    <>
      <Link
        href="/dashboard"
        className="px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        Dashboard
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="whitespace-nowrap inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log out
        </button>
      </form>
    </>
  );
}
