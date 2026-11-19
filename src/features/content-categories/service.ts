import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapCategoryError, type CategoryDone, type CategoryStore } from "./category-service";

/**
 * The admin's category writes reach the database here: as the signed-in admin through their cookies, so the service
 * role is not used. The table's policies let only the super admin insert, update and delete, so a call from anyone
 * else is refused by the database whatever the action did before it. The only callers are actions built with
 * `defineAction`, which have already checked the role.
 */
export async function createCategoryStore(): Promise<CategoryStore> {
  return categoryStore(await createServerSupabase());
}

const COLUMNS = "id, module, slug";

function done(row: { id: string; module: string; slug: string }): CategoryDone {
  return { categoryId: row.id, module: row.module, slug: row.slug };
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function categoryStore(supabase: SupabaseClient<Database>): CategoryStore {
  return {
    async insert(row) {
      const { data, error } = await supabase
        .from("content_categories")
        .insert(row)
        .select(COLUMNS)
        .single();
      if (error) throw mapCategoryError(error);
      return done(data);
    },

    async update(categoryId, row) {
      const { data, error } = await supabase
        .from("content_categories")
        .update(row)
        .eq("id", categoryId)
        .select(COLUMNS);
      if (error) throw mapCategoryError(error);
      const found = data[0];
      if (!found) throw mapCategoryError({ code: "P0002" });
      return done(found);
    },

    async setActive(categoryId, active) {
      const { data, error } = await supabase
        .from("content_categories")
        .update({ active })
        .eq("id", categoryId)
        .select(COLUMNS);
      if (error) throw mapCategoryError(error);
      const found = data[0];
      if (!found) throw mapCategoryError({ code: "P0002" });
      return done(found);
    },

    async remove(categoryId) {
      const { data, error } = await supabase
        .from("content_categories")
        .delete()
        .eq("id", categoryId)
        .select(COLUMNS);
      if (error) throw mapCategoryError(error);
      const found = data[0];
      if (!found) throw mapCategoryError({ code: "P0002" });
      return done(found);
    },
  };
}
