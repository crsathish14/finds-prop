import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { LEAD_STATUSES, type LeadStatus } from "./constants";
import { mapLeadError, type LeadStore } from "./lead-service";

/**
 * A lead's state is changed here (S7-T07): as the signed-in user through their cookies, so the service role is not
 * used and the database's own policies decide what is allowed. The only caller is an action built with
 * `defineAction`, which has already checked the role and counted the rate limit.
 */
export async function createLeadStore(): Promise<LeadStore> {
  return leadStore(await createServerSupabase());
}

const isStatus = (value: string): value is LeadStatus =>
  (LEAD_STATUSES as readonly string[]).includes(value);

/** The same store for any client that acts as the user (the integration tests sign in and pass theirs). */
export function leadStore(supabase: SupabaseClient<Database>): LeadStore {
  return {
    async setStatus(leadId, status) {
      const { data, error } = await supabase
        .from("project_leads")
        .update({ status })
        .eq("id", leadId)
        .select("id, project_id, status")
        .maybeSingle();
      if (error) throw mapLeadError(error);
      if (!data) return null;
      if (!isStatus(data.status)) throw mapLeadError({});
      return { leadId: data.id, projectId: data.project_id, status: data.status };
    },
  };
}
