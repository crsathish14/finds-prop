import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapUnitError, type UnitDone, type UnitStore } from "./unit-service";

/**
 * The admin's unit changes reach the database here (S7-T07): as the signed-in admin through their cookies, so the
 * service role is not used and the database's own policies decide what is allowed. The only caller is an action
 * built with `defineAction`, which has already checked the role and counted the rate limit.
 */
export async function createUnitStore(): Promise<UnitStore> {
  return unitStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function unitStore(supabase: SupabaseClient<Database>): UnitStore {
  /** The columns every call answers with: the unit, its project and the project's address. */
  const answer = "id, project_id, projects(slug)";

  type Answered = { id: string; project_id: string; projects: { slug: string } | null };
  const done = (row: Answered): UnitDone => {
    if (!row.projects) throw mapUnitError({});
    return { unitId: row.id, projectId: row.project_id, projectSlug: row.projects.slug };
  };

  return {
    async insert(projectId, row) {
      const { data, error } = await supabase
        .from("project_units")
        .insert({ ...row, project_id: projectId })
        .select(answer)
        .single();
      if (error || !data) throw mapUnitError(error ?? {});
      return done(data);
    },

    async update(unitId, row) {
      const { data, error } = await supabase
        .from("project_units")
        .update(row)
        .eq("id", unitId)
        .select(answer)
        .maybeSingle();
      if (error) throw mapUnitError(error);
      return data ? done(data) : null;
    },

    async remove(unitId) {
      const { data, error } = await supabase
        .from("project_units")
        .delete()
        .eq("id", unitId)
        .select(answer)
        .maybeSingle();
      if (error) throw mapUnitError(error);
      return data ? done(data) : null;
    },
  };
}
