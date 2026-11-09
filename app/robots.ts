import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config/app-url";

/** Public pages are open to crawlers. Admin, account areas, auth pages and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/buyer", "/seller", "/account", "/login", "/register"],
      },
    ],
    sitemap: appUrl("/sitemap.xml"),
  };
}
