import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { ResolvedOverviewRange } from "./range";
import { toOverview, type Overview } from "./view";

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
