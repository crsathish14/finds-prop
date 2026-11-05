import { publicEnv } from "@/lib/public-env";

/**
 * The address this deployment is served from, with no path and no trailing slash. It comes from
 * `NEXT_PUBLIC_SITE_URL` and nothing else, so a canonical link, a sitemap entry or a share link can
 * never point at an address typed into the code. In production the variable must hold the real domain.
 */
export function siteOrigin(): string {
  return new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin;
}

/** The whole address of a path on this site (`/properties?bhk=3`), for places that need one. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteOrigin()}/`).toString();
}
