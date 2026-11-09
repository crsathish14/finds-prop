import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { EditorScope } from "./service";
import {
  toProjectEditView,
  type BuilderOption,
  type FormOption,
  type ProjectDbRow,
  type ProjectEditView,
} from "./view";

/**
 * The project form's reads (S7-T02, FR-ADM-03, FR-BLD-02), as the signed-in admin or builder through their own
 * session. The table's select grant hides the review columns and the enquiry form, so a project is read through the
 * functions that return the admin's every project or a builder's own (`admin_projects`, `my_projects`), which check
 * who is asking themselves. Never cached: the form must open with what is stored. A failed read throws, so the
 * error page shows it. The `read…` functions take the client, so the integration tests can pass theirs; the `get…`
 * ones make it from the cookies.
 */

type Client = SupabaseClient<Database>;

/** One project, with its price trends, or null when there is no such project (or it is not the builder's). */
export async function readProjectForEdit(
  supabase: Client,
  scope: EditorScope,
  projectId: string,
): Promise<ProjectEditView | null> {
  const query = scope === "admin" ? supabase.rpc("admin_projects") : supabase.rpc("my_projects");
  const [project, trends] = await Promise.all([
    query.eq("id", projectId).maybeSingle(),
    supabase
      .from("project_price_trends")
      .select("month, price_per_sqft")
      .eq("project_id", projectId)
      .order("month", { ascending: true }),
  ]);
  if (project.error) {
    logger.error("project could not be read for editing", { errorCode: project.error.code });
    throw project.error;
  }
  if (trends.error) {
    logger.error("project price trends could not be read", { errorCode: trends.error.code });
    throw trends.error;
  }
  if (!project.data) return null;
  return toProjectEditView(project.data as ProjectDbRow, trends.data ?? []);
}

/** The builders an admin can give a project to, by name; the admin reads them all (`admin_builders`). */
export async function readBuilderOptions(supabase: Client): Promise<BuilderOption[]> {
  const { data, error } = await supabase
    .rpc("admin_builders")
    .select("id, name, active")
    .order("name", { ascending: true });
  if (error) {
    logger.error("builder options could not be read", { errorCode: error.code });
    throw error;
  }
  return (data ?? []).map(({ id, name, active }) => ({ id, name, active }));
}

/** The active forms an admin can choose for a project page, by name (`admin_forms`). */
export async function readFormOptions(supabase: Client): Promise<FormOption[]> {
  const { data, error } = await supabase
    .rpc("admin_forms")
    .select("id, name, active")
    .order("name", { ascending: true });
  if (error) {
    logger.error("form options could not be read", { errorCode: error.code });
    throw error;
  }
  return (data ?? []).filter((form) => form.active).map(({ id, name }) => ({ id, name }));
}

/** The project to open on the admin's edit page. */
export async function getProjectForEdit(
  scope: EditorScope,
  projectId: string,
): Promise<ProjectEditView | null> {
  return readProjectForEdit(await createServerSupabase(), scope, projectId);
}

/** The builders to choose from, for the signed-in admin. */
export async function getBuilderOptions(): Promise<BuilderOption[]> {
  return readBuilderOptions(await createServerSupabase());
}

/** The forms to choose from, for the signed-in admin. */
export async function getFormOptions(): Promise<FormOption[]> {
  return readFormOptions(await createServerSupabase());
}
