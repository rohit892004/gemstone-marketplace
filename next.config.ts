import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. Enforced (not report-only): there is no report endpoint yet, and the app loads
 * no third-party scripts, styles, fonts, frames or images (fonts come from next/font, self-hosted at build time).
 *
 * script-src needs 'unsafe-inline' because Next.js injects inline bootstrap and hydration scripts. Nonces would be
 * stricter, but Next.js only applies them to per-request rendering, and most public pages here are prerendered
 * (cacheComponents). Moving to nonces is a later hardening step. style-src needs 'unsafe-inline' for
 * inline style attributes (uPlot sets styles at runtime). 'unsafe-eval' is added in development only, for
 * React's debugging tools and the dev overlay.
 */
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  isProduction ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // HSTS only in production: local http would be pinned and break for a year otherwise.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    // Server actions default to a 1 MB body limit. Seller registration uploads several
    // documents (each up to UPLOAD_MAX_MB, default 10 MB) in one form post.
    serverActions: { bodySizeLimit: "35mb" },
    // The proxy buffers a copy of each request body (default 10 MB). A logo and a banner at the 15 MB
    // limit each, plus the form, must reach the action. Without this, a larger upload fails with "Unexpected end of form".
    proxyClientMaxBodySize: "40mb",
  },
  async redirects() {
    // Legal pages live under /legal. The older short paths stay valid (footer links use them).
    return [
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/cookies", destination: "/legal/cookies", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
