import { prisma } from "@/lib/db/client";

export interface CertificateLabOption {
  id: string;
  code: string;
  name: string;
  isOther: boolean;
}

/** Active certificate labs, admin-editable in the database. Never hard-coded. */
export async function loadActiveCertificateLabs(): Promise<CertificateLabOption[]> {
  return prisma.certificateLab.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, isOther: true },
  });
}
