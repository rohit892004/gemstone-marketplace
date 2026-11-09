import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";

/**
 * Role router. Sends each signed-in user to their home.
 *
 * Pattern for every protected page (Cache Components): the request-time check lives
 * in an async child wrapped in <Suspense>, so the static shell can still prerender.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardRouter />
    </Suspense>
  );
}

async function DashboardRouter(): Promise<null> {
  const user = await requirePageRole(["BUYER", "SELLER", "ADMIN"]);
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "SELLER") redirect("/seller");
  redirect("/buyer");
  return null; // redirect() throws; this satisfies the return type
}
