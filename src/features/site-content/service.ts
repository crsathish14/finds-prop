import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeSiteSettings } from "@/features/site";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { mapContentError, type ContentStore } from "./content-service";

/**
 * The site content reaches the database here (S7-T10): as the signed-in admin through their cookies, so the service
 * role is not used and the database's own policies decide what is allowed (only the super admin may write
 * `site_settings`). The only caller is an action built with `defineAction`, which has already checked the role and
 * counted the rate limit.
 */
export async function createContentStore(): Promise<ContentStore> {
  return contentStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function contentStore(supabase: SupabaseClient<Database>): ContentStore {
  return {
    async write(key, value) {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value: value as NonNullable<Json> }, { onConflict: "key" });
      if (error) throw mapContentError(error);
    },

    async readBounds() {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .eq("key", "region");
      if (error) throw mapContentError(error);
      return mergeSiteSettings(data, logger).region.bounds;
    },
  };
}
