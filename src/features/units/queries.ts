import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { UNITS_PAGE_SIZE } from "./constants";
import { escapeLike } from "./like";
import type { UnitFilters } from "./schemas";
import { toUnitViews, type ProjectOption, type UnitsPage } from "./view";

/**
 * The admin's Units reads (S7-T07, FR-ADM-05), as the signed-in admin through their own session: the policies of
 * `project_units` and `projects` let an admin read every project's units, and anyone else would get nothing. Never
 * cached: the numbers must be right after every change. A failed read throws, so the error page shows it. The `read…`
 * functions take the client, so the integration tests can pass the admin's; the `get…` ones make it from the cookies.
 */

const COLUMNS =
  "id, unit_number, floor_number, bhk, area_sqft, facing, price, available_from, floor_plan_path, status";

/** One page of a project's units by unit number, with the number of units the filters match. Unit numbers are unique in a project, so the number is the cursor. */
export async function readUnitsPage(
  supabase: SupabaseClient<Database>,
  filters: UnitFilters,
): Promise<UnitsPage> {
  const like = filters.search ? `%${escapeLike(filters.search)}%` : null;

  let page = supabase.from("project_units").select(COLUMNS).eq("project_id", filters.projectId);
  let counted = supabase
    .from("project_units")
    .select("id", { count: "exact", head: true })
    .eq("project_id", filters.projectId);
  if (filters.state !== "all") {
    page = page.eq("status", filters.state);
    counted = counted.eq("status", filters.state);
  }
  if (like) {
    page = page.ilike("unit_number", like);
    counted = counted.ilike("unit_number", like);
  }
  const ordered = page.order("unit_number", { ascending: true }).limit(UNITS_PAGE_SIZE + 1);
  const [rows, count] = await Promise.all([
    filters.after ? ordered.gt("unit_number", filters.after) : ordered,
    counted,
  ]);
  if (rows.error) {
    logger.error("admin units could not be read", { errorCode: rows.error.code });
    throw rows.error;
  }
  if (count.error) {
    logger.error("admin units could not be counted", { errorCode: count.error.code });
    throw count.error;
  }
  const hasMore = rows.data.length > UNITS_PAGE_SIZE;
  const shownRows = hasMore ? rows.data.slice(0, UNITS_PAGE_SIZE) : rows.data;
  const { units, skipped } = toUnitViews(shownRows);
  if (skipped > 0) logger.warn("admin unit rows could not be read", { skipped });
  const last = shownRows.at(-1);
  return {
    units,
    total: count.count ?? units.length,
    nextCursor: hasMore && last ? last.unit_number : null,
  };
}

/** Every project, by name, for the picker. The admin sees them all (`admin_projects`). */
export async function readProjectOptions(
  supabase: SupabaseClient<Database>,
): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .rpc("admin_projects")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    logger.error("admin project options could not be read", { errorCode: error.code });
    throw error;
  }
  return data.map((project) => ({ id: project.id, name: project.name }));
}

/**
 * The signed-in builder's own projects, by name, for the picker (S7-T03). `my_projects()` returns only the projects of
 * the builder (or agent) asking.
 */
export async function readMyProjectOptions(
  supabase: SupabaseClient<Database>,
): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .rpc("my_projects")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    logger.error("builder project options could not be read", { errorCode: error.code });
    throw error;
  }
  return data.map((project) => ({ id: project.id, name: project.name }));
}

/**
 * One page of a project's units for a builder, or null when the project is not theirs. The policies of `project_units`
 * also let a builder read the units of any live project (they are public), so the project is checked here first: the
 * Units page of a builder shows their own projects only.
 */
export async function readMyUnitsPage(
  supabase: SupabaseClient<Database>,
  filters: UnitFilters,
): Promise<UnitsPage | null> {
  const { data, error } = await supabase
    .rpc("my_projects")
    .select("id")
    .eq("id", filters.projectId)
    .maybeSingle();
  if (error) {
    logger.error("builder project could not be checked", { errorCode: error.code });
    throw error;
  }
  if (!data) return null;
  return readUnitsPage(supabase, filters);
}

/** The page of units for the signed-in admin. */
export async function getUnitsPage(filters: UnitFilters): Promise<UnitsPage> {
  return readUnitsPage(await createServerSupabase(), filters);
}

/** The project picker for the signed-in admin. */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  return readProjectOptions(await createServerSupabase());
}

/** The project picker for the signed-in builder. */
export async function getMyProjectOptions(): Promise<ProjectOption[]> {
  return readMyProjectOptions(await createServerSupabase());
}

/** The page of units for the signed-in builder; null when the project is not theirs. */
export async function getMyUnitsPage(filters: UnitFilters): Promise<UnitsPage | null> {
  return readMyUnitsPage(await createServerSupabase(), filters);
}
