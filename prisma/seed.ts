import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

/**
 * Seeds reference data every environment needs. Idempotent: safe to run repeatedly.
 * Admin account seeding is added in M1 by the admin workstream (lib/admin/seed-admin.ts).
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categories = [
  { name: "Diamond", slug: "diamond" },
  { name: "Ruby", slug: "ruby" },
  { name: "Sapphire", slug: "sapphire" },
  { name: "Emerald", slug: "emerald" },
  { name: "Spinel", slug: "spinel" },
  { name: "Tourmaline", slug: "tourmaline" },
  { name: "Other Coloured Stones", slug: "other-coloured-stones" },
];

/** Admin-editable in the admin area later. "Other" takes free text on the document. */
const certificateLabs = [
  { code: "gia", name: "GIA", sortOrder: 10 },
  { code: "igi", name: "IGI", sortOrder: 20 },
  { code: "grs", name: "GRS", sortOrder: 30 },
  { code: "ssef", name: "SSEF", sortOrder: 40 },
  { code: "gubelin", name: "Gübelin", sortOrder: 50 },
  { code: "agl", name: "AGL", sortOrder: 60 },
  { code: "gii", name: "GII (Jaipur)", sortOrder: 70 },
  { code: "other", name: "Other", sortOrder: 990, isOther: true },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log(`Seeded ${categories.length} categories.`);

  for (const lab of certificateLabs) {
    await prisma.certificateLab.upsert({
      where: { code: lab.code },
      update: { name: lab.name, sortOrder: lab.sortOrder, isOther: lab.isOther ?? false },
      create: { ...lab, isOther: lab.isOther ?? false },
    });
  }
  console.log(`Seeded ${certificateLabs.length} certificate labs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
