import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapListingError } from "./listing-service";
import type { MyListingsStore } from "./my-listings-service";

/**
 * What an owner does to a listing reaches the database here (S6-T03): as the signed-in owner through their
 * cookies, so the service role is not used. Closing is `close_listing`, which checks the owner and the state;
 * deleting is the owner's own delete policy on `properties`. The only callers are actions built with
 * `defineAction`, which have already checked the caller has a verified phone.
 */
export async function createMyListingsStore(): Promise<MyListingsStore> {
  return myListingsStore(await createServerSupabase());
}

/** The same store for any client that acts as the owner (the integration tests sign in and pass theirs). */
export function myListingsStore(supabase: SupabaseClient<Database>): MyListingsStore {
  return {
    async close(listingId, outcome) {
      const { data, error } = await supabase.rpc("close_listing", {
        p_listing: listingId,
        p_outcome: outcome,
      });
      const row = data?.[0];
      if (error || !row) throw mapListingError(error ?? {});
      return { listingId: row.id, shortId: row.short_id, status: row.status };
    },
    async current(listingId) {
      const { data, error } = await supabase
        .rpc("my_properties")
        .select("short_id, status")
        .eq("id", listingId)
        .maybeSingle();
      if (error) throw mapListingError(error);
      return data ? { shortId: data.short_id, status: data.status } : null;
    },
    async update(listingId, row, expectedStatus) {
      const { data, error } = await supabase
        .from("properties")
        .update(row)
        .eq("id", listingId)
        .eq("status", expectedStatus)
        .select("status");
      if (error) throw mapListingError(error);
      return data[0]?.status ?? null;
    },
    async remove(listingId) {
      const { data, error } = await supabase
        .from("properties")
        .delete()
        .eq("id", listingId)
        .select("short_id");
      if (error) throw mapListingError(error);
      return data[0]?.short_id ?? null;
    },
  };
}
