import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";
import { clientIp, visitorHash } from "@/server/rate-limit/visitor-hash";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { createPublicSupabase } from "@/server/supabase/public";
import { FORM_COLUMNS, mapFormWriteError, type FormWriteStore } from "./form-service";

/**
 * The part of the forms that touches the database (S5-T05): the form is read as an anonymous visitor
 * (the database shows only active forms and never the CRM link), and a submission is written with the
 * service role through `record_form_submission`, because visitors have no insert on submissions and
 * execute is granted to the service role alone. It is on the service-role allow-list
 * (docs/engineering/security.md 4.3). The only caller is an action built with `defineAction`, which has
 * already counted the rate limit.
 */
export function createFormWriteStore(requestId: string): FormWriteStore {
  const client = createAdminSupabase(requestId);
  return {
    async readForm(slug) {
      const { data, error } = await createPublicSupabase()
        .from("forms")
        .select(FORM_COLUMNS)
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw mapFormWriteError({ code: error.code, message: error.message });
      return { row: data, found: data !== null };
    },
    async insertSubmission(row) {
      const { data, error } = await client.rpc("record_form_submission", {
        p_form_slug: row.formSlug,
        p_visitor_hash: row.visitor,
        p_data: row.submission.data,
        p_idempotency_key: row.idempotencyKey,
        ...(row.submission.name === null ? {} : { p_name: row.submission.name }),
        ...(row.submission.mobile === null ? {} : { p_mobile: row.submission.mobile }),
        ...(row.submission.email === null ? {} : { p_email: row.submission.email }),
        ...(row.source === null ? {} : { p_source: row.source }),
        ...(row.projectSlug === null ? {} : { p_project_slug: row.projectSlug }),
      });
      if (error || typeof data !== "string") {
        throw mapFormWriteError({ code: error?.code, message: error?.message });
      }
      return data;
    },
  };
}

/**
 * Who is sending, as the same one-way hash the rate limiter counts (BR-75): the address and browser
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
