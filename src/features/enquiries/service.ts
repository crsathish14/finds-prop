import "server-only";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { mapEnquiryWriteError, type EnquiryWriteStore } from "./enquiry-service";

/**
 * The part of the enquiry that writes (S5-T03): it reaches the database with the service role, because
 * visitors have no insert on `enquiries` (the function `submit_enquiry` is the only way in, and execute
 * is granted to the service role alone, so nobody can call it with another user's id). It is on the
 * service-role allow-list (docs/engineering/security.md 4.3). The only caller is the action built with
 * `defineAction`, which has already checked that the caller is signed in with a verified phone, and
 * counted the rate limit.
 */
export function createEnquiryWriteStore(requestId: string): EnquiryWriteStore {
  const client = createAdminSupabase(requestId);
  return {
    async insertEnquiry(row) {
      const { data, error } = await client.rpc("submit_enquiry", {
        p_short_id: row.shortId,
        p_user_id: row.userId,
        p_name: row.name,
        p_phone: row.phone,
        ...(row.email === null ? {} : { p_email: row.email }),
        ...(row.message === null ? {} : { p_message: row.message }),
      });
      if (error || typeof data !== "string") {
        throw mapEnquiryWriteError({ code: error?.code, message: error?.message });
      }
      return data;
    },
  };
}
