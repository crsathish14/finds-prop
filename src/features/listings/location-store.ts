import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapLocationError, type ListingLocationStore } from "./location-service";
import { myListingsStore } from "./my-listings-store";

/**
 * Setting a listing's location reaches the database here (place search PR 7b, ADR-141): as the signed-in owner
 * through their cookies, so the service role is not used. The write is `set_listing_location` (ADR-138), which
 * checks the owner, the point and the state; reading the listing is `my_properties()`, which holds only the
 * caller's own rows. The only caller is an action built with `defineAction`, which has already checked the
 * caller has a verified phone. Nothing here logs or returns the point.
 */
export async function createListingLocationStore(): Promise<ListingLocationStore> {
  return listingLocationStore(await createServerSupabase());
}

/** The same store for any client that acts as the owner (the integration tests sign in and pass theirs). */
export function listingLocationStore(supabase: SupabaseClient<Database>): ListingLocationStore {
  const mine = myListingsStore(supabase);
  return {
    current: (listingId) => mine.current(listingId),
    async setLocation(listingId, lat, lng) {
      const { data, error } = await supabase.rpc("set_listing_location", {
        p_property_id: listingId,
        p_lat: lat,
        p_lng: lng,
      });
      if (error || typeof data !== "string") throw mapLocationError(error ?? {});
      return data;
    },
  };
}
