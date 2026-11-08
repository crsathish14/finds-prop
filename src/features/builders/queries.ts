import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { toBuilderRows, type BuilderRowView } from "./view";

/**
 * Every builder with their status, projects, leads and last sign-in, for the admin's Builders table (S7-T05,
 * FR-ADM-04). It is one call to `admin_builder_overview()`, made as the signed-in admin: the function checks that
 * itself and refuses anyone else, so the layout's gate is not the only thing standing between a customer and this
 * list. A failed read throws, so the portal's error page shows it. `now` is when the read was made, so the screen
 * can say "3 days ago" without reading the clock itself.
 */
export async function getBuilderOverview(): Promise<{ builders: BuilderRowView[]; now: number }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_builder_overview");
  if (error) {
    logger.error("the builders could not be read", { errorCode: error.code });
    throw error;
  }
  return { builders: toBuilderRows(data), now: Date.now() };
}
