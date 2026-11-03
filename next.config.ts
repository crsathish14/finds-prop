import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Static security headers (plan 07 section 8). Environment-dependent headers (noindex, CSP) are
 * set in src/proxy.ts. Cache Components and partial prefetching are enabled as the template
 * generated them; ADR-003 / DEC-10 are confirmed or reversed by spike S1-SPK-01.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Pictures of homes and projects come from the public Supabase storage buckets (the hosted
  // projects, and the local stack in development). The CSP already allows these hosts.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // A top-level [locale] segment cannot compose a root 404 page (Next.js docs: not-found).
  experimental: { globalNotFound: true },
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

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
