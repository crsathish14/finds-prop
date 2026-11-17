import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { addDays, indiaToday } from "@/lib/india-days";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { ResolvedOverviewRange } from "./range";
import { toOverview, toPlacesUsage, type Overview, type PlacesUsageNumbers } from "./view";

/**
 * The admin's overview numbers over a range of days (S7-T06 part 3, FR-ADM-01). One call to `admin_overview()`, made
 * with the signed-in admin's own client: the function refuses anyone who is not the super admin. A failed call, or an
 * answer that is not in the expected shape, throws: the page catches it and says so, with a way to try again.
 */
export async function readAdminOverview(
  supabase: SupabaseClient<Database>,
  range: Pick<ResolvedOverviewRange, "from" | "to">,
  now: Date = new Date(),
): Promise<Overview> {
  const { data, error } = await supabase.rpc("admin_overview", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    logger.error("the admin's overview could not be read", { errorCode: error.code });
    throw error;
  }
  try {
    return toOverview(data, now);
  } catch (problem) {
    logger.error("the admin's overview came back in a shape the page does not know");
    throw problem;
  }
}

export async function getAdminOverview(
  range: Pick<ResolvedOverviewRange, "from" | "to">,
  now: Date = new Date(),
): Promise<Overview> {
  return readAdminOverview(await createServerSupabase(), range, now);
}

/** How many days (counting today) the place search card covers. */
export const PLACES_USAGE_DAYS = 30;

/**
 * Calls to Ola Maps over the last 30 India days, today included (PR 6b of the Ola Maps plan, ADR-134): one call to
 * `admin_places_usage`, made with the signed-in admin's own client (the function refuses anyone who is not the super
 * admin). Null when no call has been counted yet. A failed call, or an answer that is not in the expected shape,
 * throws: the page catches it and shows the failed block, and the rest of the dashboard is unaffected.
 */
export async function readPlacesUsage(
  supabase: SupabaseClient<Database>,
  now: Date,
): Promise<PlacesUsageNumbers | null> {
  const today = indiaToday(now);
  const { data, error } = await supabase.rpc("admin_places_usage", {
    p_from: addDays(today, 1 - PLACES_USAGE_DAYS),
    p_to: today,
  });
  if (error) {
    logger.error("the place search usage could not be read", { errorCode: error.code });
    throw error;
  }
  try {
    return toPlacesUsage(data);
  } catch (problem) {
    logger.error("the place search usage came back in a shape the page does not know");
    throw problem;
  }
}

export async function getPlacesUsage(now: Date): Promise<PlacesUsageNumbers | null> {
  return readPlacesUsage(await createServerSupabase(), now);
}
