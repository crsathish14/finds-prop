import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { ResolvedRange } from "./range";
import { toInsightsNumbers, type InsightsNumbers } from "./view";

/**
 * The numbers for the signed-in builder over a range of days, optionally for one of their projects (S7-T03 step E,
 * FR-BLD-06). One call to `builder_insights()`, made with the builder's own client: the function counts only their
 * own projects and refuses anyone who is not an active builder. A failed read throws, so the portal's error page
 * shows it.
 */
export async function readBuilderInsights(
  supabase: SupabaseClient<Database>,
  range: Pick<ResolvedRange, "from" | "to">,
  project?: string,
): Promise<InsightsNumbers> {
  const { data, error } = await supabase.rpc("builder_insights", {
    p_from: range.from,
    p_to: range.to,
    ...(project ? { p_project: project } : {}),
  });
  if (error) {
    logger.error("the builder's insights could not be read", { errorCode: error.code });
    throw error;
  }
  return toInsightsNumbers(data);
}

export async function getBuilderInsights(
  range: Pick<ResolvedRange, "from" | "to">,
  project?: string,
): Promise<InsightsNumbers> {
  return readBuilderInsights(await createServerSupabase(), range, project);
}
