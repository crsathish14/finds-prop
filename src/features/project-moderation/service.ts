import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapModerationError, type ProjectModerationStore } from "./moderation-service";

/**
 * The admin's project decisions reach the database here (S7-T04): as the signed-in admin through their cookies, so the
 * service role is not used. `moderate_project` checks for itself that the caller is a super admin, and the delete
 * policy of `projects` lets only the admin delete, so a call from anyone else is refused by the database whatever
 * the action did before it. The only callers are actions built with `defineAction`, which have already checked the
 * role.
 */
export async function createProjectModerationStore(): Promise<ProjectModerationStore> {
  return projectModerationStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function projectModerationStore(supabase: SupabaseClient<Database>): ProjectModerationStore {
  return {
    async decide(projectId, decision) {
      const { data, error } = await supabase.rpc("moderate_project", {
        p_project: projectId,
        p_action: decision,
      });
      const row = data?.[0];
      if (error || !row) throw mapModerationError(error ?? {});
      return {
        projectId: row.id,
        slug: row.slug,
        moderation: row.moderation,
        published: row.published,
        featured: row.featured,
      };
    },

    async remove(projectId) {
      const { data, error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)
        .select("id, slug");
      if (error) throw mapModerationError(error);
      const row = data[0];
      // Nothing deleted: no such project, or the policy hid it from this caller.
      if (!row) throw mapModerationError({ code: "P0002" });
      return { projectId: row.id, slug: row.slug };
    },
  };
}
