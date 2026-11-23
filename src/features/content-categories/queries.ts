import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import type { CategoryModule } from "./constants";
import { CATEGORY_COLUMNS, toCategoryViews, type CategoryView } from "./view";

/** The cache tag of the module that lists a category: a job department is shown on the careers pages. */
export function categoryTag(module: CategoryModule): string {
  return module === "department" ? CACHE_TAGS.careers : CACHE_TAGS[module];
}

/**
 * The categories of one list, as a visitor sees them: only the active ones (the table's policy hides the rest, so the
 * pages, the filters and the AI tools agree). Public data, so it uses the cookie-less client and is cached under the
 * module's tag; a failed read answers an empty list and is logged, so a page still renders.
 */
export async function getPublicCategories(module: CategoryModule): Promise<CategoryView[]> {
  "use cache";
  cacheTag(categoryTag(module));
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("content_categories")
    .select(CATEGORY_COLUMNS)
    .eq("module", module)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    logger.error("the categories could not be read", { module, errorCode: error.code });
    return [];
  }
  return toCategoryViews(data);
}

/**
 * Every category of one list, hidden ones too, for the admin's manager. Read as the signed-in admin through their own
 * session (the policy lets only the super admin see the hidden ones). Never cached: the list must be right after every
 * change. A failed read throws, so the portal's error page shows it.
 */
export async function readAdminCategories(
  supabase: SupabaseClient<Database>,
  module: CategoryModule,
): Promise<CategoryView[]> {
  const { data, error } = await supabase
    .from("content_categories")
    .select(CATEGORY_COLUMNS)
    .eq("module", module)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    logger.error("the admin's categories could not be read", { module, errorCode: error.code });
    throw error;
  }
  return toCategoryViews(data);
}

export async function getAdminCategories(module: CategoryModule): Promise<CategoryView[]> {
  return readAdminCategories(await createServerSupabase(), module);
}
