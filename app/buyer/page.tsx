import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";

export default function BuyerHomePage() {
  return (
    <Suspense fallback={null}>
      <BuyerHome />
    </Suspense>
  );
}

async function BuyerHome() {
  const user = await requirePageRole(["BUYER"]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Buyer account</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        Welcome{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-ink-soft">Signed in as {user.email}</p>

      <div className="mt-10 rounded-lg border border-dashed border-line bg-surface-raised p-6">
        <h2 className="text-lg font-semibold text-ink">Coming soon</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>Wishlist: save stones you are watching</li>
          <li>Enquiries: contact sellers about a specific stone</li>
          <li>Chat: follow up with sellers in one place</li>
        </ul>
      </div>
    </section>
  );
}
