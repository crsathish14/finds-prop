import "server-only";
import { headers } from "next/headers";
import { ActionError } from "@/server/actions/normalise-error";
import { env } from "@/server/env";
import { clientIp, visitorHash } from "@/server/rate-limit/visitor-hash";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { createServerSupabase } from "@/server/supabase/server";
import { mapProjectWriteError, type ProjectWriteStore } from "./lead-service";

/**
 * The part of the project page that writes (S4-T09 step D): it reaches the database with the service
 * role, because anonymous and signed-in visitors have no insert on leads and events (the functions
 * `submit_project_lead` and `track_project_event` are the only way in, and execute is granted to the
 * service role alone). It is on the service-role allow-list (docs/engineering/security.md 4.3). Every
 * caller is an action built with `defineAction`, which has already checked who is calling and counted
 * the rate limit.
 */

/** The database store: one function call for a lead, one for an event. */
export function createProjectWriteStore(requestId: string): ProjectWriteStore {
  const client = createAdminSupabase(requestId);
  return {
    async insertLead(row) {
      const { data, error } = await client.rpc("submit_project_lead", {
        p_slug: row.slug,
        p_kind: row.kind,
        p_name: row.name,
        p_phone: row.phone,
        p_visitor_hash: row.visitor,
        ...(row.email === null ? {} : { p_email: row.email }),
        ...(row.message === null ? {} : { p_message: row.message }),
        ...(row.visitDate === null ? {} : { p_visit_date: row.visitDate }),
      });
      if (error || typeof data !== "string") {
        throw mapProjectWriteError({ code: error?.code, message: error?.message });
      }
      return data;
    },
    async recordEvent(row) {
      const { data, error } = await client.rpc("track_project_event", {
        p_slug: row.slug,
        p_event_type: row.event,
        p_visitor_hash: row.visitor,
      });
      if (error || typeof data !== "boolean") {
        throw mapProjectWriteError({ code: error?.code, message: error?.message });
      }
      return data;
    },
  };
}

/**
 * Who is calling, as the same one-way hash the rate limiter counts (BR-75): the address and browser
 * mixed with a server-only secret. The raw address is never stored.
 */
export async function currentVisitor(): Promise<string> {
  const incoming = await headers();
  return visitorHash(
    env.RATE_LIMIT_HMAC_SECRET,
    clientIp(incoming, env.APP_ENV !== "local"),
    incoming.get("user-agent") ?? "",
  );
}

/**
 * The signed-in account's own phone as digits (`919840012345`), from the verified token. A lead's
 * phone is this number and never one typed in a form, so a request cannot be sent for someone else's
 * number. The action has already required a verified phone; this refuses again if the token has none.
 */
export async function verifiedPhoneDigits(): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const phone = data?.claims.phone;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (error || !/^[0-9]{6,15}$/.test(digits)) {
    throw new ActionError("FORBIDDEN", "A verified phone number is required.", {
      reason: "PHONE_NOT_VERIFIED",
    });
  }
  return digits;
}
