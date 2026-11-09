import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { PROJECT_LIST_MAX } from "./constants";
import { toAdminProjectRows, type AdminProjectRow } from "./view";

/** The admin's projects, with whether the list was cut at the most the page reads. */
export interface AdminProjectList {
  projects: AdminProjectRow[];
  truncated: boolean;
}

/**
 * Every project with its builder's name and number of leads, newest first, for the admin's Projects page (S7-T04,
 * FR-ADM-03). One call to `admin_project_overview()`, made as the signed-in admin: the function checks that itself and
 * refuses anyone else, so the layout's gate is not the only thing standing between a customer and this list. Reads one
 * row more than the page shows to know whether the list was cut. A failed read throws, so the portal's error page
 * shows it.
 */
export async function readAdminProjects(
  supabase: SupabaseClient<Database>,
): Promise<AdminProjectList> {
  const { data, error } = await supabase.rpc("admin_project_overview").limit(PROJECT_LIST_MAX + 1);
  if (error) {
    logger.error("the admin's projects could not be read", { errorCode: error.code });
    throw error;
  }
  const { projects, skipped } = toAdminProjectRows(data);
  if (skipped > 0) logger.warn("admin project rows could not be read", { skipped });
  const truncated = data.length > PROJECT_LIST_MAX;
  return { projects: truncated ? projects.slice(0, PROJECT_LIST_MAX) : projects, truncated };
}

export async function getAdminProjects(): Promise<AdminProjectList> {
  return readAdminProjects(await createServerSupabase());
}
