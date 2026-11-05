import type { MetadataRoute } from "next";

/**
 * The parts of the site that crawlers must not enter (FR-PUB-14): the admin and builder portals, the
 * customer dashboard, posting, sign-in and password pages, the comparison, the API and the design system. They are also
 * `noindex` on the pages themselves, so a link from elsewhere cannot get them listed.
 */
export const DISALLOWED_PATHS = [
  "/admin",
  "/builder",
  "/dashboard",
  "/post-property",
  "/auth",
  "/reset-password",
  "/compare",
  "/api",
  "/design-system",
] as const;

/**
 * `robots.txt`. Production lets crawlers in, except for the paths above, and names the sitemap. Any
 * other environment (preview, staging, development) asks every crawler to stay out and names no
 * sitemap; the proxy also sends `X-Robots-Tag: noindex` there.
 */
export function robotsFile(options: { production: boolean; origin: string }): MetadataRoute.Robots {
  if (!options.production) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] },
    sitemap: `${options.origin}/sitemap.xml`,
  };
}
