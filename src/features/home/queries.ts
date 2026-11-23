import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG } from "@/features/search";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { TOP_DEVELOPERS_MAX } from "@/lib/top-developers";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import {
  chosenBuilders,
  developerFromProjects,
  DEVELOPER_COUNT,
  rankBuilders,
} from "./new-launches";
import { listingRowSchema, rankingRowSchema, type DeveloperRow, type ListingRow } from "./schemas";

/** Cache tags the admin actions will refresh when a listing or a project is approved or changed. */
export const HOME_LISTINGS_TAG = LISTINGS_TAG;
export const HOME_PROJECTS_TAG = CACHE_TAGS.homeProjects;

/** How many homes each homepage section shows (the UX: Featured homes 6, Newest 8). */
export const FEATURED_COUNT = 6;
export const NEWEST_COUNT = 8;

const MS_PER_DAY = 86_400_000;

/** The two fixed sections `home_properties()` answers; their sizes are fixed in the database too. */
type HomeKind = "featured" | "newest";

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
async function readHomes(kind: HomeKind, section: string, cityKey?: string): Promise<ListingRow[]> {
  const { data, error } = await createPublicSupabase().rpc(
    "home_properties",
    cityKey ? { p_kind: kind, p_city: cityKey } : { p_kind: kind },
  );
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
export async function getFeaturedHomes(cityKey?: string): Promise<ListingRow[]> {
  "use cache";
  cacheTag(HOME_LISTINGS_TAG);
  cacheLife("minutes");
  return readHomes("featured", "featured", cityKey);
}

/** The newest approved homes of a city (all cities without one). */
export async function getNewestHomes(cityKey?: string): Promise<ListingRow[]> {
  "use cache";
  cacheTag(HOME_LISTINGS_TAG);
  cacheLife("minutes");
  return readHomes("newest", "newest", cityKey);
}

/**
 * The developers for "New launches": builders that have approved, published projects, featured
 * projects first and then the newest (an inactive builder is not visible to visitors at all, BR-94,
 * so the database already leaves it out). One read of `home_developers()` gives the public projects
 * in that order (at most 1000, each with only its cover and its builder); the builders are ranked
 * and counted from them and each card takes its builder's first projects. A failed read is logged
 * by its code only and the section is left out. With a city key only the projects of that city count.
 */
export async function getNewLaunchDevelopers(
  chosenIds: readonly string[] = [],
  cityKey?: string,
): Promise<DeveloperRow[]> {
  "use cache";
  cacheTag(HOME_PROJECTS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase().rpc(
    "home_developers",
    cityKey ? { p_city: cityKey } : {},
  );
  if (error) {
    logger.error("homepage developers could not be read, the section is left out", {
      errorCode: error.code,
    });
    return [];
  }
  const rows: unknown[] = Array.isArray(data) ? data : [];
  const ranking = rows.flatMap((row) => {
    const parsed = rankingRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  // The super admin's choice and order win; with none (or none usable) the developers are ranked as before.
  const chosen = chosenBuilders(ranking, chosenIds.slice(0, TOP_DEVELOPERS_MAX));
  const ranked = chosen.length > 0 ? chosen : rankBuilders(ranking, DEVELOPER_COUNT);
  const developers = ranked.map(({ builderId, projectCount }) =>
    developerFromProjects(builderId, projectCount, rows),
  );
  return developers.flatMap((developer) => (developer ? [developer] : []));
}
