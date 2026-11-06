import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { FORM_COLUMNS, parseFormRow } from "./form-service";
import type { FormDefinition } from "./schemas";

/** Cache tag the admin form builder will refresh when it saves a form (FR-ADM-08). */
export const FORMS_TAG = CACHE_TAGS.forms;

/**
 * The form the contact page shows (S5-T05): the active form placed on the contact page, the most recently
 * edited one when there are several. Public data, so it uses the cookie-less client and is cached. A form
 * that cannot be read, or whose stored fields do not fit, is `null` (logged), and the page says the form
 * could not load; that answer is kept for seconds only, so the page recovers on its own.
 */
export async function getContactForm(): Promise<FormDefinition | null> {
  "use cache";
  cacheTag(FORMS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("forms")
    .select(FORM_COLUMNS)
    .eq("placement", "contact")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("the contact form could not be read", { errorCode: error.code });
    cacheLife("seconds");
    return null;
  }
  const form = data === null ? null : parseFormRow(data);
  if (data !== null && form === null) logger.error("the contact form's stored fields do not fit");
  if (form === null) cacheLife("seconds");
  return form;
}
