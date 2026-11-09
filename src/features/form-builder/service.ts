import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { mapFormError, type FormBuilderStore, type FormRow } from "./builder-service";

/**
 * The admin's form writes reach the database here (S7-T08): as the signed-in admin through their cookies, so the
 * service role is not used. The table's policies let only the super admin insert, update, delete and read every form
 * (and the CRM link, which is hidden from everyone else), so a call from anyone else is refused by the database
 * whatever the action did before it. The only callers are actions built with `defineAction`, which have already
 * checked the role.
 */
export async function createFormBuilderStore(): Promise<FormBuilderStore> {
  return formBuilderStore(await createServerSupabase());
}

const toColumns = (row: FormRow) => ({
  name: row.name,
  slug: row.slug,
  kind: row.kind,
  placement: row.placement,
  project_id: row.project_id,
  crm_integration_id: row.crm_integration_id,
  button_text: row.button_text,
  success_message: row.success_message,
  fields: row.fields as NonNullable<Json>,
  active: row.active,
});

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function formBuilderStore(supabase: SupabaseClient<Database>): FormBuilderStore {
  return {
    async insert(row) {
      const { data, error } = await supabase
        .from("forms")
        .insert(toColumns(row))
        .select("id, slug")
        .single();
      if (error) throw mapFormError(error);
      return { formId: data.id, slug: data.slug };
    },

    async update(formId, row) {
      const { data, error } = await supabase
        .from("forms")
        .update(toColumns(row))
        .eq("id", formId)
        .select("id, slug");
      if (error) throw mapFormError(error);
      const found = data[0];
      if (!found) throw mapFormError({ code: "P0002" });
      return { formId: found.id, slug: found.slug };
    },

    async setActive(formId, active) {
      const { data, error } = await supabase
        .from("forms")
        .update({ active })
        .eq("id", formId)
        .select("id, slug");
      if (error) throw mapFormError(error);
      const found = data[0];
      if (!found) throw mapFormError({ code: "P0002" });
      return { formId: found.id, slug: found.slug };
    },

    async read(formId) {
      // The admin's own list: it also carries the CRM link, which a plain read of the table does not.
      const { data, error } = await supabase.rpc("admin_forms");
      if (error) throw mapFormError(error);
      const found = data.find((form) => form.id === formId);
      if (!found) return null;
      return {
        name: found.name,
        slug: found.slug,
        kind: found.kind,
        placement: found.placement,
        project_id: found.project_id,
        crm_integration_id: found.crm_integration_id,
        button_text: found.button_text,
        success_message: found.success_message,
        fields: found.fields,
        active: found.active,
      };
    },

    async remove(formId) {
      const { data, error } = await supabase
        .from("forms")
        .delete()
        .eq("id", formId)
        .select("id, slug");
      if (error) throw mapFormError(error);
      const found = data[0];
      if (!found) throw mapFormError({ code: "P0002" });
      return { formId: found.id, slug: found.slug };
    },
  };
}
