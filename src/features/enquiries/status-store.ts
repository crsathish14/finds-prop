import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapEnquiryStatusError, type EnquiryStatusStore } from "./status-service";

/**
 * The owner's change of an enquiry reaches the database here (S6-T03): as the signed-in owner through their
 * cookies, so the service role is not used. The update policy lets only the owner of the listing change a
 * row, the column grant allows only `status`, and `guard_enquiries` allows only forward moves.
 */
export async function createEnquiryStatusStore(): Promise<EnquiryStatusStore> {
  return enquiryStatusStore(await createServerSupabase());
}

/** The same store for any client that acts as the owner (the integration tests sign in and pass theirs). */
export function enquiryStatusStore(supabase: SupabaseClient<Database>): EnquiryStatusStore {
  return {
    async setStatus(enquiryId, status) {
      const { data, error } = await supabase
        .from("enquiries")
        .update({ status })
        .eq("id", enquiryId)
        .select("id");
      if (error) throw mapEnquiryStatusError({ code: error.code, message: error.message });
      return data.length > 0;
    },
  };
}
