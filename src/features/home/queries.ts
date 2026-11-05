import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG } from "@/features/search";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import type { Database } from "@/types/database.types";
import {
  developerFromProjects,
  DEVELOPER_COUNT,
  PROJECTS_PER_DEVELOPER,
  rankBuilders,
} from "./new-launches";
import { listingRowSchema, rankingRowSchema, type DeveloperRow, type ListingRow } from "./schemas";

/** Cache tags the admin actions will refresh when a listing or a project is approved or changed. */
export const HOME_LISTINGS_TAG = LISTINGS_TAG;
export const HOME_PROJECTS_TAG = "home-projects";

/** How many homes each homepage section shows (the UX: Featured homes 6, Newest 8). */
export const FEATURED_COUNT = 6;
export const NEWEST_COUNT = 8;

/** How many public projects are read to rank the builders; above this the counts stop at it. */
const RANKING_READ_LIMIT = 1000;
const MS_PER_DAY = 86_400_000;

type SearchArgs = Database["public"]["Functions"]["search_properties"]["Args"];

/** Whole days between a time and now, or null when the time is missing or not a date. */
function ageInDays(publishedAt: string | null, now: number): number | null {
  if (publishedAt === null) return null;
  const then = Date.parse(publishedAt);
  return Number.isNaN(then) ? null : Math.floor((now - then) / MS_PER_DAY);
}

/**
 * Reads homes through `search_properties()` as an anonymous visitor, so only approved listings and
 * public columns can come back (BR-90). A failed read is logged by its code only and gives no homes,
 * so the section is left out instead of the page failing. Rows that do not fit are skipped and counted.
 */
async function readHomes(args: SearchArgs, section: string): Promise<ListingRow[]> {
  const { data, error } = await createPublicSupabase().rpc("search_properties", args);
  if (error) {
    logger.error("homepage homes could not be read, the section is left out", {
      errorCode: error.code,
      section,
    });
    return [];
  }
  const now = Date.now();
  const homes: ListingRow[] = [];
  let skipped = 0;
  for (const row of data ?? []) {
    const parsed = listingRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    homes.push({ ...parsed.data, ageDays: ageInDays(parsed.data.published_at, now) });
  }
  if (skipped > 0) {
    logger.warn("homepage homes skipped, they do not match the expected shape", {
      section,
      skipped,
    });
  }
  return homes;
}

/** The featured homes, newest first (the Featured label is the owner's to give: BR-92). */
export async function getFeaturedHomes(): Promise<ListingRow[]> {
  "use cache";
  cacheTag(HOME_LISTINGS_TAG);
  cacheLife("minutes");
  return readHomes({ p_label: "featured", p_sort: "newest", p_limit: FEATURED_COUNT }, "featured");
}

/** The newest approved homes. */
export async function getNewestHomes(): Promise<ListingRow[]> {
  "use cache";
  cacheTag(HOME_LISTINGS_TAG);
  cacheLife("minutes");
  return readHomes({ p_sort: "newest", p_limit: NEWEST_COUNT }, "newest");
}

/**
 * The developers for "New launches": builders that have approved, published projects, featured
 * projects first and then the newest (an inactive builder is not visible to visitors at all, BR-94,
 * so the database already leaves it out). One read ranks the builders and counts their projects; then
 * one small read for each of the first few gets the projects to show. Any failed read is logged by
 * its code only and the developer, or the whole section, is left out.
 */
export async function getNewLaunchDevelopers(): Promise<DeveloperRow[]> {
  "use cache";
  cacheTag(HOME_PROJECTS_TAG);
  cacheLife("minutes");

  const client = createPublicSupabase();
  const ranking = await client
    .from("projects")
    .select("builder_id")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RANKING_READ_LIMIT);
  if (ranking.error) {
    logger.error("homepage developers could not be ranked, the section is left out", {
      errorCode: ranking.error.code,
    });
    return [];
  }
  const ranked = rankBuilders(
    (ranking.data ?? []).flatMap((row) => {
      const parsed = rankingRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
    DEVELOPER_COUNT,
  );

  const developers = await Promise.all(
    ranked.map(async ({ builderId, projectCount }) => {
      const { data, error } = await client
        .from("projects")
        .select("slug, name, builder_id, images, builders!inner(id, name, description)")
        .eq("builder_id", builderId)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(PROJECTS_PER_DEVELOPER);
      if (error) {
        logger.error("homepage developer could not be read, it is left out", {
          errorCode: error.code,
        });
        return null;
      }
      return developerFromProjects(builderId, projectCount, data ?? []);
    }),
  );
  return developers.flatMap((developer) => (developer ? [developer] : []));
}
