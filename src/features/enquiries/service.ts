import "server-only";
import { z } from "zod";
import type { EnquiryMailFinder } from "@/features/enquiry-mail";
import { ActionError } from "@/server/actions/normalise-error";
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

const mailRowSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  properties: z
    .object({
      title: z.string().nullable(),
      slug: z.string(),
      short_id: z.string(),
      owner_id: z.string(),
    })
    .nullable(),
});

/**
 * Reads what the mail about a stored enquiry needs (ADR-188), with the service role because the poster's private
 * contact email is readable only by its owner and the admin (ADR-186) and this runs after the visitor's request has
 * ended. It is the same allow-listed module as the write above, and the only caller is the enquiry action's
 * `after()`. The event holds the enquiry's id; the name, the optional email, the home and the owner's address are
 * read here. The phone and the message are not selected at all. Answers null for an event of another kind and for an
 * enquiry or home that is gone; throws when the database cannot be read (the notifier logs the code and goes on).
 */
export function createEnquiryMailFinder(requestId: string): EnquiryMailFinder {
  const client = createAdminSupabase(requestId);
  return async (event) => {
    if (event.kind !== "enquiry.received") return null;
    const { data, error } = await client
      .from("enquiries")
      .select("name, email, properties(title, slug, short_id, owner_id)")
      .eq("id", event.enquiryId)
      .maybeSingle();
    if (error) throw new ActionError("INTERNAL", "The enquiry could not be read for its mail");
    const row = mailRowSchema.safeParse(data);
    if (!row.success || !row.data.properties) return null;
    const home = row.data.properties;
    const owner = await client
      .from("profiles")
      .select("contact_email")
      .eq("id", home.owner_id)
      .maybeSingle();
    if (owner.error) throw new ActionError("INTERNAL", "The poster could not be read for the mail");
    return {
      posterId: home.owner_id,
      posterEmail: owner.data?.contact_email ?? null,
      enquirerName: row.data.name,
      enquirerEmail: row.data.email,
      title: home.title,
      pagePath: `/properties/${home.slug}-${home.short_id}`,
      dashboardPath: "/dashboard?tab=received",
    };
  };
}
