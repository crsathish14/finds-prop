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

/**
 * The form a project page shows (S5-T05, change 4, BR-49): the one the admin chose for the project, else
 * one made for it alone, else one shown on every project page. The database function follows that chain
 * and returns only what a visitor may see, because `projects.form_id` is not readable by visitors. `null`
 * means the page shows its built-in card: no form is assigned, the read failed, or the stored fields do
 * not fit (the last two are logged). Public data, cached for minutes under the `forms` tag; a failure is
 * kept for seconds only.
 */
export async function getProjectForm(projectSlug: string): Promise<FormDefinition | null> {
  "use cache";
  cacheTag(FORMS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase().rpc("public_project_form", {
    p_project_slug: projectSlug,
  });
  if (error) {
    logger.error("a project's form could not be read", { errorCode: error.code });
    cacheLife("seconds");
    return null;
  }
  const row = data[0] ?? null;
  const form = row === null ? null : parseFormRow(row);
  if (row !== null && form === null) {
    logger.error("a project's form has stored fields that do not fit");
    cacheLife("seconds");
  }
  return form;
}
