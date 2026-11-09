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
        className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        Dashboard
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong"
        >
          Log out
        </button>
      </form>
    </>
  );
}
