import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { PROJECTS_TAG } from "@/features/projects";
import { LISTINGS_TAG } from "@/features/search";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { LOCALITY_HOME_COLUMNS, LOCALITY_PROJECT_COLUMNS } from "./columns";
import { countLocalities, type LocalityCount } from "./localities";

/** PostgREST answers at most this many rows at a time (`max_rows` in the project), so the reads page. */
const PAGE_SIZE = 1000;

/**
 * The most homes and projects whose locality is counted. Above this the counts stop growing and the result
 * says it is not complete. Ten pages of names is the size the search was measured at (S4-SPK-01); a count in
 * the database would need a migration, which this read avoids.
 */
const HOMES_COUNTED_MAX = 10_000;
const PROJECTS_COUNTED_MAX = 1000;

const rowSchema = z.object({ locality: z.string().nullable() });

type Page = { data: unknown; error: { code: string } | null };

/** The localities visitors can find something in, and how true the counts are. */
export type LocalityCounts = {
  /** Busiest first. */
  localities: LocalityCount[];
  /** False when there were more homes or projects than the read counts: the counts are then "at least". */
  complete: boolean;
  /** When the database was read (an ISO date and time). The list is cached for minutes after that. */
  readAt: string;
};

/** Every locality name the pages give, read a page at a time up to `limit` rows. */
async function readNames(
  readPage: (from: number, to: number) => PromiseLike<Page>,
  limit: number,
  source: "homes" | "projects",
): Promise<{ names: string[]; complete: boolean }> {
  const names: string[] = [];
  for (let from = 0; from < limit; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, limit) - 1;
    const { data, error } = await readPage(from, to);
    if (error) {
      logger.error("localities could not be read", { errorCode: error.code, source });
      throw new Error("localities could not be read");
    }
    const rows = z.array(rowSchema).safeParse(data);
    if (!rows.success) {
      logger.error("locality rows do not fit the expected shape", { source });
      throw new Error("locality rows do not fit the expected shape");
    }
    for (const row of rows.data) {
      if (row.locality !== null) names.push(row.locality);
    }
    if (rows.data.length < to - from + 1) return { names, complete: true };
  }
  return { names, complete: false };
}

/**
 * The localities of every approved home and every live project of an active builder, with how many of each,
 * for the assistant's `list_localities` tool (ADR-128 section 5.1). Read as an anonymous visitor, so the
 * database's own rules decide what exists (BR-90, BR-94), and only the locality is asked for: never an
 * address, a point or an owner. A failed or malformed read throws, so it is never cached. Cached for minutes
 * under the homes tag and the projects tag, so an approval, a sale or a builder change refreshes it.
 */
export async function getLocalityCounts(): Promise<LocalityCounts> {
  "use cache";
  cacheTag(LISTINGS_TAG, PROJECTS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();
  const [homes, projects] = await Promise.all([
    readNames(
      (from, to) =>
        client
          .from("properties")
          .select(LOCALITY_HOME_COLUMNS)
          .order("short_id", { ascending: true })
          .range(from, to),
      HOMES_COUNTED_MAX,
      "homes",
    ),
    readNames(
      (from, to) =>
        client
          .from("projects")
          .select(LOCALITY_PROJECT_COLUMNS)
          .order("slug", { ascending: true })
          .range(from, to),
      PROJECTS_COUNTED_MAX,
      "projects",
    ),
  ]);
  return {
    localities: countLocalities(homes.names, projects.names),
    complete: homes.complete && projects.complete,
    readAt: new Date().toISOString(),
  };
}
