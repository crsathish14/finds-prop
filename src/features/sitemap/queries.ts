import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { getBlogSitemapEntries } from "@/features/blog";
import { getJobSitemapEntries, isJobOpenAt } from "@/features/careers";
import { getPublicFaqs } from "@/features/faq";
import { PROJECTS_TAG } from "@/features/projects";
import { LISTINGS_TAG } from "@/features/search";
import { getContentModuleOn } from "@/features/site";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { SITEMAP_HOME_COLUMNS, SITEMAP_PROJECT_COLUMNS } from "./columns";
import {
  homesRoom,
  SITEMAP_PROJECTS_MAX,
  type SitemapBlog,
  type SitemapCareers,
  type SitemapFaq,
  type SitemapHome,
  type SitemapProject,
} from "./entries";

/** PostgREST answers at most this many rows at a time (`max_rows` in the project), so the reads page. */
const PAGE_SIZE = 1000;

const homeRowSchema = z.object({
  slug: z.string().min(1),
  short_id: z.string().min(1),
  updated_at: z.string().min(1),
});
const projectRowSchema = z.object({ slug: z.string().min(1), updated_at: z.string().min(1) });

/**
 * Every approved home (up to `limit`), newest change first, as an anonymous visitor: the database's
 * own rules decide what exists, and only the granted columns are asked for. A failed or malformed read
 * throws, so it is never cached and the sitemap answers an error rather than a partial list. Cached
 * for minutes under the homes tag, so an approval refreshes it.
 */
async function readHomes(limit: number): Promise<SitemapHome[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();
  const homes: SitemapHome[] = [];
  for (let from = 0; from < limit; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, limit) - 1;
    const { data, error } = await client
      .from("properties")
      .select(SITEMAP_HOME_COLUMNS)
      .order("updated_at", { ascending: false })
      .order("short_id", { ascending: true })
      .range(from, to);
    if (error) {
      logger.error("sitemap homes could not be read", { errorCode: error.code });
      throw new Error("sitemap homes could not be read");
    }
    const rows = z.array(homeRowSchema).safeParse(data);
    if (!rows.success) {
      logger.error("sitemap home rows do not fit the expected shape", {});
      throw new Error("sitemap home rows do not fit the expected shape");
    }
    homes.push(
      ...rows.data.map((row) => ({
        slug: row.slug,
        shortId: row.short_id,
        updatedAt: row.updated_at,
      })),
    );
    if (rows.data.length < to - from + 1) break;
  }
  return homes;
}

/** Every live project of an active builder (up to the cap), read the same way as the homes. */
async function readProjects(): Promise<SitemapProject[]> {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();
  const projects: SitemapProject[] = [];
  for (let from = 0; from < SITEMAP_PROJECTS_MAX; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, SITEMAP_PROJECTS_MAX) - 1;
    const { data, error } = await client
      .from("projects")
      .select(SITEMAP_PROJECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .order("slug", { ascending: true })
      .range(from, to);
    if (error) {
      logger.error("sitemap projects could not be read", { errorCode: error.code });
      throw new Error("sitemap projects could not be read");
    }
    const rows = z.array(projectRowSchema.loose()).safeParse(data);
    if (!rows.success) {
      logger.error("sitemap project rows do not fit the expected shape", {});
      throw new Error("sitemap project rows do not fit the expected shape");
    }
    projects.push(...rows.data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at })));
    if (rows.data.length < to - from + 1) break;
  }
  return projects;
}

/**
 * What the sitemap lists: the live projects, then as many approved homes as still fit under the
 * 45,000-address cap. A read that fails throws (the sitemap then answers 500 and a crawler tries
 * again later). Logs when a cap cut the list short.
 */
export async function getSitemapSources(): Promise<{
  homes: SitemapHome[];
  projects: SitemapProject[];
}> {
  const projects = await readProjects();
  const room = homesRoom(projects.length);
  const homes = await readHomes(room);
  if (homes.length >= room) logger.warn("sitemap reached its address cap", { cap: room });
  return { homes, projects };
}

/**
 * The FAQ page's entry (ADR-143): its newest question's date, or null while the FAQ module is switched off or no
 * question is published, so the sitemap never lists a page that answers not-found or has nothing on it. Reads the
 * cached list of published questions (tag `faq`), so a published or trashed question refreshes it.
 */
export async function getSitemapFaq(): Promise<SitemapFaq | null> {
  if (!(await getContentModuleOn("faq"))) return null;
  const faqs = await getPublicFaqs();
  let newest: string | null = null;
  for (const faq of faqs) {
    if (newest === null || new Date(faq.updatedAt) > new Date(newest)) newest = faq.updatedAt;
  }
  return newest === null ? null : { updatedAt: newest };
}

/**
 * The Blog's entries (ADR-143): the published, non-trashed articles with the date each last changed, or null while the
 * Blog module is switched off or nothing is published, so the sitemap never lists a page that answers not-found. Reads
 * the cached list (tag `blog`), so a published, unpublished or trashed article refreshes it.
 */
export async function getSitemapBlog(): Promise<SitemapBlog | null> {
  if (!(await getContentModuleOn("blog"))) return null;
  const posts = await getBlogSitemapEntries();
  return posts.length === 0 ? null : { posts };
}

/**
 * The Careers entries (ADR-143): the open jobs (not past their closing date, not in Trash: the row policy decides) with
 * the date each last changed, or null while the Careers module is switched off or no job is open, so the sitemap never
 * lists a page that answers not-found. Reads the cached list (tag `careers`), so opening, closing or trashing a job
 * refreshes it. The list is kept for hours, so a job whose closing date has passed since is dropped here, as the job's
 * page does (`isJobOpenAt`), and a closed job is never listed for the rest of the hour.
 */
export async function getSitemapCareers(): Promise<SitemapCareers | null> {
  if (!(await getContentModuleOn("careers"))) return null;
  const now = new Date();
  const jobs = (await getJobSitemapEntries())
    .filter((job) => isJobOpenAt(job, now))
    .map((job) => ({ slug: job.slug, updatedAt: job.updatedAt }));
  return jobs.length === 0 ? null : { jobs };
}
