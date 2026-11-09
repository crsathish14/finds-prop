import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapProjectError, type ProjectDone, type ProjectStore } from "./project-service";

/** Whose projects the store reads: the admin reads every project, a builder their own. */
export type EditorScope = "admin" | "builder";

/**
 * A project is saved here (S7-T02): as the signed-in admin or builder through their cookies, so the service role is
 * not used and the database's own rules decide what is allowed. The only callers are actions built with
 * `defineAction`, which have already checked the role and counted the rate limit.
 */
export async function createProjectStore(scope: EditorScope): Promise<ProjectStore> {
  return projectStore(await createServerSupabase(), scope);
}

/** The same store for any client that acts as the admin or the builder (the integration tests sign in and pass theirs). */
export function projectStore(supabase: SupabaseClient<Database>, scope: EditorScope): ProjectStore {
  /**
   * Where a project stands now. The table's own select grant hides its review state, so it is read through the
   * function that returns the admin's every project or a builder's own.
   */
  async function stateOf(projectId: string): Promise<{ slug: string; moderation: string } | null> {
    const query =
      scope === "admin"
        ? supabase.rpc("admin_projects").select("slug, moderation")
        : supabase.rpc("my_projects").select("slug, moderation");
    const { data, error } = await query.eq("id", projectId).maybeSingle();
    if (error) throw mapProjectError(error);
    return data;
  }

  return {
    async insert(row, builderId) {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...row, ...(builderId ? { builder_id: builderId } : {}) })
        .select("id")
        .single();
      if (error || !data) throw mapProjectError(error ?? {});
      const state = await stateOf(data.id);
      if (!state) throw mapProjectError({});
      return {
        projectId: data.id,
        slug: state.slug,
        previousSlug: null,
        moderation: state.moderation,
        previousModeration: null,
      } satisfies ProjectDone;
    },

    async update(projectId, row) {
      const before = await stateOf(projectId);
      if (!before) return null;
      const { data, error } = await supabase
        .from("projects")
        .update(row)
        .eq("id", projectId)
        .select("id")
        .maybeSingle();
      if (error) throw mapProjectError(error);
      if (!data) return null;
      const after = await stateOf(projectId);
      if (!after) throw mapProjectError({});
      return {
        projectId,
        slug: after.slug,
        previousSlug: before.slug === after.slug ? null : before.slug,
        moderation: after.moderation,
        previousModeration: before.moderation,
      } satisfies ProjectDone;
    },

    async saveTrends(projectId, rows) {
      const { error } = await supabase.rpc("save_project_price_trends", {
        p_project: projectId,
        p_rows: rows,
      });
      if (error) throw mapProjectError(error);
    },
  };
}
