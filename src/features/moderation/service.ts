import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapModerationError, type ModerationStore } from "./moderation-service";

/**
 * The admin's decisions reach the database here (S6-T04): as the signed-in admin through their cookies, so the
 * service role is not used. `moderate_listing` checks for itself that the caller is a super admin, so a
 * call from anyone else is refused by the database whatever the action did before it. The only caller is an
 * action built with `defineAction`, which has already checked the role.
 */
export async function createModerationStore(): Promise<ModerationStore> {
  return moderationStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function moderationStore(supabase: SupabaseClient<Database>): ModerationStore {
  return {
    async decide(listingId, decision, reason) {
      const { data, error } = await supabase.rpc("moderate_listing", {
        p_listing: listingId,
        p_action: decision,
        ...(reason !== null ? { p_reason: reason } : {}),
      });
      const row = data?.[0];
      if (error || !row) throw mapModerationError(error ?? {});
      return {
        listingId: row.id,
        shortId: row.short_id,
        status: row.status,
        featured: row.featured,
      };
    },
  };
}
