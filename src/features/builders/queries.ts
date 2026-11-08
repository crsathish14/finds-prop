import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { toBuilderRows, type BuilderRowView } from "./view";

/**
 * Every builder with their status, projects, leads and last sign-in, for the admin's Builders table (S7-T05,
 * FR-ADM-04). It is one call to `admin_builder_overview()`, made as the signed-in admin: the function checks that
 * itself and refuses anyone else, so the layout's gate is not the only thing standing between a customer and this
 * list. A failed read throws, so the portal's error page shows it.
 */
export async function getBuilderOverview(): Promise<BuilderRowView[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_builder_overview");
  if (error) {
    logger.error("the builders could not be read", { errorCode: error.code });
    throw error;
  }
  return toBuilderRows(data);
}
