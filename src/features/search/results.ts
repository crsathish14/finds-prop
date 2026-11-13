import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { LISTINGS_TAG, listingRowSchema, type ListingRow } from "./listing-row";
import { toSearchRpcArgs } from "./rpc-args";
import type { SearchParams } from "./schemas";

const MS_PER_DAY = 86_400_000;

/** `total_count` comes on every row; PostgREST gives a bigint as a number. */
const totalSchema = z.object({
  total_count: z.union([
    z.number().int().nonnegative(),
    z
      .string()
      .regex(/^\d{1,15}$/)
      .transform(Number),
  ]),
});

/**
 * What the results page shows: the homes for the asked length and how many match in all, or a
 * failure. A failure carries no detail, since the page only offers "Try again" with the filters kept.
 * `readAt` is when the database was read (an ISO date and time, taken inside the cached read, so it is
 * the time of the last refill and not the time of the call); the AI assistant quotes it as "as of".
 */
export type SearchResults =
  { status: "ok"; homes: ListingRow[]; total: number; readAt: string } | { status: "failed" };

function ageInDays(publishedAt: string | null, now: number): number | null {
  if (publishedAt === null) return null;
  const then = Date.parse(publishedAt);
  return Number.isNaN(then) ? null : Math.floor((now - then) / MS_PER_DAY);
}

/**
 * Reads one page of results through `search_properties()` as an anonymous visitor, so only approved
 * listings and public columns can come back (BR-90). The total is the function's own `total_count`
 * (frontend.md 6.1 rule 6), not a second query. Rows that do not fit are skipped and counted; a
 * failed read is logged by its code only (never the filters, which can hold what a person typed).
 * Cached for minutes under the homes tag, so an approval refreshes it. A failed read throws, so it is
 * never cached: "Try again" asks the database again instead of getting the same failure back.
 */
async function readResults(
  params: SearchParams,
): Promise<Extract<SearchResults, { status: "ok" }>> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase().rpc(
    "search_properties",
    toSearchRpcArgs(params),
  );
  if (error) {
    logger.error("search results could not be read", { errorCode: error.code });
    throw new Error("search results could not be read");
  }
  const rows = data ?? [];
  const now = Date.now();
  const readAt = new Date(now).toISOString();
  const homes: ListingRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = listingRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    homes.push({ ...parsed.data, ageDays: ageInDays(parsed.data.published_at, now) });
  }
  if (skipped > 0) {
    logger.warn("search results skipped, they do not match the expected shape", { skipped });
  }
  const first = rows[0] === undefined ? undefined : totalSchema.safeParse(rows[0]);
  // No rows means no match. A first row with no readable total falls back to what we hold.
  const total = first?.success ? first.data.total_count : homes.length;
  return { status: "ok", homes, total, readAt };
}

/** One page of results, or a failure with no detail (the page offers Try again with the filters kept). */
export async function getSearchResults(params: SearchParams): Promise<SearchResults> {
  try {
    return await readResults(params);
  } catch (error) {
    // The prerender signal and redirects are Next.js control flow, not failures of the read.
    unstable_rethrow(error);
    return { status: "failed" };
  }
}
