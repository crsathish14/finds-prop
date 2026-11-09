import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectOptions } from "@/features/units";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { toAdminForms, type AdminFormView, type FormBuilderOptions } from "./view";

/** The admin's forms with what the editor's pickers offer. */
export interface FormBuilderData extends FormBuilderOptions {
  forms: AdminFormView[];
}

/**
 * Every form, newest change first, with the projects and CRM integrations the editor can point a form at (S7-T08,
 * FR-ADM-08). Read as the signed-in admin through their own session: `admin_forms()` checks that itself and returns
 * nothing to anyone else, and the policies of `crm_integrations` let only the admin read the integrations' names (the
 * secrets are in a table of their own). Never cached: the list must be right after every change. A failed read
 * throws, so the portal's error page shows it.
 */
export async function readFormBuilderData(
  supabase: SupabaseClient<Database>,
  projects: { id: string; name: string }[],
): Promise<FormBuilderData> {
  const [forms, integrations] = await Promise.all([
    supabase.rpc("admin_forms"),
    supabase.from("crm_integrations").select("id, name").order("name", { ascending: true }),
  ]);
  if (forms.error) {
    logger.error("the admin's forms could not be read", { errorCode: forms.error.code });
    throw forms.error;
  }
  if (integrations.error) {
    logger.error("the CRM integrations could not be read", { errorCode: integrations.error.code });
    throw integrations.error;
  }
  const options = { projects, integrations: integrations.data };
  const sorted = [...forms.data].sort((first, second) =>
    second.updated_at.localeCompare(first.updated_at),
  );
  return { ...options, forms: toAdminForms(sorted, options) };
}

export async function getFormBuilderData(): Promise<FormBuilderData> {
  const projects = await getProjectOptions();
  return readFormBuilderData(await createServerSupabase(), projects);
}
