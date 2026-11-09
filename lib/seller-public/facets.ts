import { cache } from "react";
import { prisma } from "@/lib/db/client";
import { publicListingWhere } from "@/lib/listings/visibility";

/** Filter dropdown options for the catalogue: only values that exist on public listings. */
export const getCatalogueFacets = cache(async () => {
  const [categories, species, shapes] = await Promise.all([
    prisma.category.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" } }),
    prisma.gemstone.findMany({
      where: { ...publicListingWhere(), species: { not: null } },
      distinct: ["species"],
      select: { species: true },
      orderBy: { species: "asc" },
      take: 100,
    }),
    prisma.gemstone.findMany({
      where: { ...publicListingWhere(), shape: { not: null } },
      distinct: ["shape"],
      select: { shape: true },
      orderBy: { shape: "asc" },
      take: 100,
    }),
  ]);
  return {
    categories,
    species: species.map((s) => s.species).filter((s): s is string => !!s),
    shapes: shapes.map((s) => s.shape).filter((s): s is string => !!s),
  };
});
