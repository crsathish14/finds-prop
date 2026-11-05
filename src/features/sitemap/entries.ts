import type { MetadataRoute } from "next";
import { projectPath, PROJECTS_PATH } from "@/features/projects";
import { propertyPath } from "@/features/property";
import { SEARCH_PATH } from "@/features/search";

/**
 * A sitemap file may hold 50,000 addresses. This one stops at 45,000, so there is room to spare; a
 * site that grows past it splits the sitemap in two (Next.js `generateSitemaps`) instead of silently
 * losing homes.
 */
export const SITEMAP_MAX_URLS = 45_000;

/** The pages that always exist and have no date of their own: the homepage and the two lists. */
export const STATIC_PATHS = ["/", SEARCH_PATH, PROJECTS_PATH] as const;

/** The most projects the sitemap reads. Homes get what is left of `SITEMAP_MAX_URLS`. */
export const SITEMAP_PROJECTS_MAX = 5_000;

export type SitemapHome = { slug: string; shortId: string; updatedAt: string };
export type SitemapProject = { slug: string; updatedAt: string };

/** A date the database stored, or nothing when it does not read as one (the entry then has no date). */
function modified(updatedAt: string): Date | undefined {
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** How many homes fit once the static pages and the projects are counted. */
export function homesRoom(projectCount: number): number {
  return Math.max(0, SITEMAP_MAX_URLS - STATIC_PATHS.length - projectCount);
}

/**
 * The sitemap (FR-PUB-14): the built public pages, then every live project and every approved home
 * with the date it last changed. Only addresses that exist today are listed; the contact and legal
 * pages join when they are built. Never more than `SITEMAP_MAX_URLS`.
 */
export function sitemapEntries(input: {
  origin: string;
  homes: readonly SitemapHome[];
  projects: readonly SitemapProject[];
}): MetadataRoute.Sitemap {
  const at = (path: string) => `${input.origin}${path}`;
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: at(path) }));
  for (const project of input.projects) {
    entries.push({ url: at(projectPath(project.slug)), lastModified: modified(project.updatedAt) });
  }
  for (const home of input.homes) {
    entries.push({
      url: at(propertyPath(home.slug, home.shortId)),
      lastModified: modified(home.updatedAt),
    });
  }
  return entries.slice(0, SITEMAP_MAX_URLS);
}
