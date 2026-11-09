import { randomBytes } from "node:crypto";

/**
 * URL-safe seller slug: "Rajesh Gems & Co." -> "rajesh-gems-co-3f9a1c".
 * The random suffix keeps slugs unique across businesses with the same name.
 */
export function generateSellerSlug(businessName: string, suffix: string = randomBytes(3).toString("hex")): string {
  const base = businessName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "seller"}-${suffix}`;
}
