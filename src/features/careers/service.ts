import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapJobError, type JobStore } from "./job-service";

/**
 * The Careers admin's writes reach the database here: as the signed-in admin through their cookies, so the service
 * role is not used. The table's policies let only the super admin insert and update, so a call from anyone else is
 * refused whatever the action did before it. The only callers are actions built with `defineAction`, which have already
 * checked the role.
 */
export async function createJobStore(): Promise<JobStore> {
  return jobStore(await createServerSupabase());
}

const STORED_COLUMNS =
  "id, slug, status, deleted_at, closes_at, summary, description, requirements";

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function jobStore(supabase: SupabaseClient<Database>): JobStore {
  return {
    async insert(row) {
      const { data, error } = await supabase
        .from("job_postings")
        .insert(row)
        .select("id, slug")
        .single();
      if (error) throw mapJobError(error);
      return { jobId: data.id, slug: data.slug };
    },

    async read(jobId) {
      const { data, error } = await supabase
        .from("job_postings")
        .select(STORED_COLUMNS)
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw mapJobError(error);
      if (!data) return null;
      return {
        id: data.id,
        slug: data.slug,
        status: data.status,
        deletedAt: data.deleted_at,
        closesAt: data.closes_at,
        summary: data.summary,
        description: data.description,
        requirements: data.requirements,
      };
    },

    async update(jobId, patch) {
      const { data, error } = await supabase
        .from("job_postings")
        .update(patch)
        .eq("id", jobId)
        .select("id");
      if (error) throw mapJobError(error);
      if (data.length === 0) throw mapJobError({ code: "P0002" });
    },
  };
}
