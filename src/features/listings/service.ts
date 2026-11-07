import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapListingError, type ListingCallerStore } from "./listing-service";

/**
 * The wizard's database access (S6-T02): everything is done as the signed-in owner through their cookies and
 * Row Level Security, so the service role is not used (the insert, update and delete policies on
 * `properties` and the grants on its columns decide what an owner may touch). The only callers are actions
 * built with `defineAction`, which have already checked the caller has a verified phone.
 */
export async function createListingCallerStore(): Promise<ListingCallerStore> {
  return listingCallerStore(await createServerSupabase());
}

/** The same store for any client that acts as the caller (the integration tests sign in and pass theirs). */
export function listingCallerStore(supabase: SupabaseClient<Database>): ListingCallerStore {
  return {
    async insertDraft(row) {
      const { data, error } = await supabase
        .from("properties")
        .insert(row)
        .select("id, short_id")
        .single();
      if (error || !data) throw mapListingError(error ?? {});
      return { id: data.id, shortId: data.short_id };
    },
    async updateDraft(listingId, row) {
      // Only a draft: a pending or approved listing is changed by the edit flow (S6-T05), not here.
      const { data, error } = await supabase
        .from("properties")
        .update(row)
        .eq("id", listingId)
        .eq("status", "draft")
        .select("id");
      if (error) throw mapListingError(error);
      return data.length > 0;
    },
    async deleteDraft(listingId) {
      const { data, error } = await supabase
        .from("properties")
        .delete()
        .eq("id", listingId)
        .eq("status", "draft")
        .select("id");
      if (error) throw mapListingError(error);
      return data.length > 0;
    },
    async submit(listingId) {
      const { data, error } = await supabase.rpc("submit_listing", { p_listing: listingId });
      if (error || typeof data !== "string") throw mapListingError(error ?? {});
      return data;
    },
  };
}
