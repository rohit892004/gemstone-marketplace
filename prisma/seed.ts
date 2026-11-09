import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

/**
 * Seeds reference data that every environment needs.
 * Idempotent: safe to run repeatedly.
 * Admin account creation is added in M1 together with password hashing.
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

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
