import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { FaqStatus } from "./constants";
import { mapFaqError, type FaqDone, type FaqStore } from "./faq-service";

/**
 * The admin's FAQ writes reach the database here: as the signed-in admin through their cookies, so the service role is
 * not used. The table's policies let only the super admin insert and update, so a call from anyone else is refused by
 * the database whatever the action did before it. The only callers are actions built with `defineAction`, which have
 * already checked the role.
 */
export async function createFaqStore(): Promise<FaqStore> {
  return faqStore(await createServerSupabase());
}

const COLUMNS = "id, category_id, status";

interface Written {
  id: string;
  category_id: string;
  status: string;
}

function done(row: Written): FaqDone {
  const status: FaqStatus = row.status === "published" ? "published" : "draft";
  return { faqId: row.id, categoryId: row.category_id, status };
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function faqStore(supabase: SupabaseClient<Database>): FaqStore {
  /** The one question a write matched, or "not found" when it matched none (a wrong id, or the wrong place). */
  function onlyOne(rows: Written[] | null): FaqDone {
    const found = rows?.[0];
    if (!found) throw mapFaqError({ code: "P0002" });
    return done(found);
  }

  return {
    async insert(row) {
      const { data, error } = await supabase.from("faqs").insert(row).select(COLUMNS).single();
      if (error) throw mapFaqError(error);
      return done(data);
    },

    async nextSortOrder(categoryId) {
      const { data, error } = await supabase
        .from("faqs")
        .select("sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: false })
        .limit(1);
      if (error) throw mapFaqError(error);
      const highest = data[0]?.sort_order;
      return highest === undefined ? 1 : highest + 1;
    },

    async update(faqId, changes) {
      const { data, error } = await supabase
        .from("faqs")
        .update(changes)
        .eq("id", faqId)
        .is("deleted_at", null)
        .select(COLUMNS);
      if (error) throw mapFaqError(error);
      return onlyOne(data);
    },

    async setStatus(faqId, status) {
      const { data, error } = await supabase
        .from("faqs")
        .update({ status })
        .eq("id", faqId)
        .is("deleted_at", null)
        .select(COLUMNS);
      if (error) throw mapFaqError(error);
      return onlyOne(data);
    },

    async trash(faqId) {
      const { data, error } = await supabase
        .from("faqs")
        .update({ status: "draft", deleted_at: new Date().toISOString() })
        .eq("id", faqId)
        .is("deleted_at", null)
        .select(COLUMNS);
      if (error) throw mapFaqError(error);
      return onlyOne(data);
    },

    async restore(faqId) {
      const { data, error } = await supabase
        .from("faqs")
        .update({ deleted_at: null })
        .eq("id", faqId)
        .not("deleted_at", "is", null)
        .select(COLUMNS);
      if (error) throw mapFaqError(error);
      return onlyOne(data);
    },

    async reorder(categoryId, faqIds) {
      const { data, error } = await supabase.rpc("reorder_faqs", {
        p_category: categoryId,
        p_ids: faqIds,
      });
      if (error) throw mapFaqError(error);
      return data;
    },
  };
}
