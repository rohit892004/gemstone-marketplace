import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Server actions default to a 1 MB body limit. Seller registration uploads several
    // documents (each up to UPLOAD_MAX_MB, default 10 MB) in one form post.
    serverActions: { bodySizeLimit: "35mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
