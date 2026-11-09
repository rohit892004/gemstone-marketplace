import Link from "next/link";
import { Suspense } from "react";
import type { ApprovalStatus } from "@/app/generated/prisma/client";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardStats />
    </Suspense>
  );
}

const STATUSES: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

async function DashboardStats() {
  await requirePageRole(["ADMIN"]);

  // Two cheap aggregates: one groupBy for seller statuses, one count for buyers.
  const [groups, buyerCount] = await Promise.all([
    prisma.sellerProfile.groupBy({ by: ["approvalStatus"], _count: { _all: true } }),
    prisma.user.count({ where: { role: "BUYER" } }),
  ]);

  const sellerCounts: Record<ApprovalStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  for (const group of groups) sellerCounts[group.approvalStatus] = group._count._all;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/sellers?status=${status}`}
            className="rounded border border-stone-300 bg-white p-4 hover:border-stone-500"
          >
            <p className="text-xs uppercase tracking-wide text-stone-600">Sellers, {status.toLowerCase()}</p>
            <p className="text-2xl font-semibold">{sellerCounts[status]}</p>
          </Link>
        ))}
        <div className="rounded border border-stone-300 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-600">Buyers</p>
          <p className="text-2xl font-semibold">{buyerCount}</p>
        </div>
      </section>
      {sellerCounts.PENDING > 0 ? (
        <p className="text-sm">
          <Link href="/admin/sellers?status=PENDING" className="underline">
            Review {sellerCounts.PENDING} pending seller application{sellerCounts.PENDING === 1 ? "" : "s"}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
