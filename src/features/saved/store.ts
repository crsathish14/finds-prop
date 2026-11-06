import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import type { SavedStore } from "./service";

/**
 * The saving store, as the signed-in visitor (their own session, so the database's row rules apply:
 * a visitor writes only their own saved rows, and only for a home they can see). The user id is set by
 * the database from the session, never sent by the browser.
 */
export async function savedStore(): Promise<SavedStore> {
  const supabase = await createServerSupabase();
  return {
    async findVisibleHome(shortId) {
      const { data, error } = await supabase
        .from("properties")
        .select("id")
        .eq("short_id", shortId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    async insertSaved(propertyId) {
      const { error } = await supabase.from("saved_properties").insert({ property_id: propertyId });
      if (error) throw error;
    },
    async deleteSaved(propertyId) {
      const { error } = await supabase
        .from("saved_properties")
        .delete()
        .eq("property_id", propertyId);
      if (error) throw error;
    },
  };
}
