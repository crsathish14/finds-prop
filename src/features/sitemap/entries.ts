import type { MetadataRoute } from "next";
import { blogArticlePath, BLOG_PATH } from "@/features/blog";
import { CAREERS_PATH, jobPath } from "@/features/careers";
import { FAQ_PATH } from "@/features/faq";
import { projectPath } from "@/features/projects";
import { propertyPath } from "@/features/property";

/**
 * A sitemap file may hold 50,000 addresses. This one stops at 45,000, so there is room to spare; a
 * site that grows past it splits the sitemap in two (Next.js `generateSitemaps`) instead of silently
 * losing homes.
 */
export const SITEMAP_MAX_URLS = 45_000;

/** The pages that always exist and have no date of their own: the homepage. The lists are for signed-in visitors, so they are not here. */
export const STATIC_PATHS = ["/"] as const;

/** The most projects the sitemap reads. Homes get what is left of `SITEMAP_MAX_URLS`. */
export const SITEMAP_PROJECTS_MAX = 5_000;

export type SitemapHome = { slug: string; shortId: string; updatedAt: string };
export type SitemapProject = { slug: string; updatedAt: string };
/** The FAQ page: when its newest question changed. Absent (null) while the FAQ module is off or nothing is published. */
export type SitemapFaq = { updatedAt: string };
/** The published, non-trashed Blog articles. Absent (null) while the Blog module is off or nothing is published. */
export type SitemapBlogPost = { slug: string; updatedAt: string };
export type SitemapBlog = { posts: readonly SitemapBlogPost[] };

/** The open Careers jobs. Absent (null) while the Careers module is off or no job is open. */
export type SitemapJob = { slug: string; updatedAt: string };
export type SitemapCareers = { jobs: readonly SitemapJob[] };

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
 * with the date it last changed, the FAQ page when it is on and has questions, and the Blog list and its articles when the Blog is on and has some. Only addresses that exist today
 * are listed; the contact and legal pages join when they are built. Never more than `SITEMAP_MAX_URLS`.
 */
export function sitemapEntries(input: {
  origin: string;
  homes: readonly SitemapHome[];
  projects: readonly SitemapProject[];
  faq?: SitemapFaq | null;
  blog?: SitemapBlog | null;
  careers?: SitemapCareers | null;
}): MetadataRoute.Sitemap {
  const at = (path: string) => `${input.origin}${path}`;
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: at(path) }));
  // The FAQ page is listed only while the module is on and a question is published (ADR-143).
  if (input.faq) entries.push({ url: at(FAQ_PATH), lastModified: modified(input.faq.updatedAt) });
  // The Blog list is listed with the fixed pages while the module is on and an article is published (ADR-143); the
  // articles themselves follow the homes, so a cap cuts articles before it cuts homes.
  const articles = input.blog?.posts ?? [];
  if (articles.length > 0) {
    const newest = articles.reduce((latest, post) =>
      new Date(post.updatedAt) > new Date(latest.updatedAt) ? post : latest,
    );
    entries.push({ url: at(BLOG_PATH), lastModified: modified(newest.updatedAt) });
  }
  // The Careers list is listed the same way while the module is on and a job is open (ADR-143).
  const jobs = input.careers?.jobs ?? [];
  if (jobs.length > 0) {
    const newest = jobs.reduce((latest, job) =>
      new Date(job.updatedAt) > new Date(latest.updatedAt) ? job : latest,
    );
    entries.push({ url: at(CAREERS_PATH), lastModified: modified(newest.updatedAt) });
  }
  for (const project of input.projects) {
    entries.push({ url: at(projectPath(project.slug)), lastModified: modified(project.updatedAt) });
  }
  for (const home of input.homes) {
    entries.push({
      url: at(propertyPath(home.slug, home.shortId)),
      lastModified: modified(home.updatedAt),
    });
  }
  for (const post of articles) {
    entries.push({ url: at(blogArticlePath(post.slug)), lastModified: modified(post.updatedAt) });
  }
  for (const job of jobs) {
    entries.push({ url: at(jobPath(job.slug)), lastModified: modified(job.updatedAt) });
  }
  return entries.slice(0, SITEMAP_MAX_URLS);
}
