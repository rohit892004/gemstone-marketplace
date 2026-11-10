import { prisma } from "@/lib/db/client";

/**
 * Read queries for the requester pages. Each one selects only the columns its page shows. Nothing here
 * returns the requester identity to a valuator, and nothing public exposes more than the verification
 * page allows (see verificationView in access.ts).
 */

/** The viewer's own requests, newest first. */
export async function listRequesterValuations(userId: string) {
  return prisma.valuation.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reference: true,
      gemstoneType: true,
      status: true,
      source: true,
      withdrawnAt: true,
      submittedAt: true,
      createdAt: true,
    },
  });
}

/** The viewer's completed or withdrawn reports, newest first. Their PDFs stay downloadable. */
export async function listSavedReports(userId: string) {
  return prisma.valuation.findMany({
    where: {
      requesterId: userId,
      OR: [{ status: { in: ["AUTO_VALUED", "COMPLETED"] } }, { withdrawnAt: { not: null } }],
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      reference: true,
      gemstoneType: true,
      status: true,
      valuedBy: true,
      completedAt: true,
      withdrawnAt: true,
      isDemo: true,
    },
  });
}

/**
 * Columns the result page needs that the shared view does not carry: the demo flag, the rule-engine factors, and
 * the listing ownership used for the publish-on-listing rule. Only the requester calls this, after getValuationView
 * has checked access.
 */
export async function getResultExtras(valuationId: string) {
  return prisma.valuation.findUnique({
    where: { id: valuationId },
    select: {
      isDemo: true,
      autoFactors: true,
      withdrawnAt: true,
      gemstoneId: true,
      gemstone: { select: { seller: { select: { userId: true } } } },
    },
  });
}

/** Reference IDs of published reports on a listing that carry demo reference data. */
export async function demoReferencesForListing(gemstoneId: string): Promise<Set<string>> {
  const rows = await prisma.valuation.findMany({
    where: { gemstoneId, publishedOnListing: true, isDemo: true },
    select: { reference: true },
  });
  return new Set(rows.map((r) => r.reference));
}

/** Categories and active certificate labels for the details form. */
export async function loadDetailFormOptions() {
  const [categories, labs] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.certificateLab.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { categories, labs };
}

/** Public verification row. Only the fields verificationView needs. Never the price, range, requester or notes. */
export async function findVerificationRow(reference: string) {
  return prisma.valuation.findUnique({
    where: { reference },
    select: {
      reference: true,
      completedAt: true,
      submittedAt: true,
      gemstoneType: true,
      status: true,
      withdrawnAt: true,
      valuedBy: true,
    },
  });
}

/** The stored category and lab IDs. The view carries only their names, and the form needs the IDs. */
export async function getValuationIds(valuationId: string): Promise<{ categoryId: string | null; labId: string | null } | null> {
  return prisma.valuation.findUnique({ where: { id: valuationId }, select: { categoryId: true, labId: true } });
}
