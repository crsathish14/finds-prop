import "server-only";
import { publicEnv } from "@/lib/public-env";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { QUEUE_PAGE_SIZE } from "./constants";
import { decodeCursor, encodeCursor } from "./cursor";
import type { QueueFilters } from "./schemas";
import { toCounts, toLocalities, toQueueItems, type QueueCounts, type QueuePage } from "./view";

/**
 * The admin's queue reads (S6-T04, FR-ADM-02), as the signed-in admin through their own session: the three
 * database functions check for themselves that the caller is a super admin (ADR-064), so a read by anyone
 * else fails there, not here. Never cached: the numbers must be right after every decision. A failed read
 * throws, so the error page shows it.
 */

/** One page of the queue, newest submission first. Reads one row more than a page to know whether there is another. */
export async function getQueuePage(filters: QueueFilters): Promise<QueuePage> {
  const supabase = await createServerSupabase();
  const cursor = decodeCursor(filters.after);
  const { data, error } = await supabase.rpc("admin_listing_queue", {
    p_tab: filters.tab,
    p_limit: QUEUE_PAGE_SIZE + 1,
    ...(filters.locality !== undefined ? { p_locality: filters.locality } : {}),
    ...(filters.kind !== undefined ? { p_kind: filters.kind } : {}),
    ...(cursor ? { p_after_at: cursor.at, p_after_id: cursor.id } : {}),
  });
  if (error) {
    logger.error("admin listing queue could not be read", { errorCode: error.code });
    throw error;
  }
  const { items, skipped } = toQueueItems(data, publicEnv.NEXT_PUBLIC_SUPABASE_URL);
  if (skipped > 0) logger.warn("admin listing queue rows could not be read", { skipped });
  const hasMore = data.length > QUEUE_PAGE_SIZE;
  const shown = hasMore ? items.slice(0, QUEUE_PAGE_SIZE) : items;
  const last = shown.at(-1);
  return { items: shown, nextCursor: hasMore && last ? encodeCursor(last) : null, skipped };
}

/** The numbers on the tabs and in the sidebar. */
export async function getQueueCounts(): Promise<QueueCounts> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_listing_counts");
  if (error) {
    logger.error("admin listing counts could not be read", { errorCode: error.code });
    throw error;
  }
  return toCounts(data);
}

/** The localities to filter by: those with a listing that is not a draft. */
export async function getQueueLocalities(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_listing_localities");
  if (error) {
    logger.error("admin listing localities could not be read", { errorCode: error.code });
    throw error;
  }
  return toLocalities(data);
}
