import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { mapMailTemplateError, type MailTemplateStore } from "./save-service";

/**
 * The mail wording reaches the database here (ADR-183): as the signed-in admin through their cookies, so the service
 * role is not used and the database's own policies decide what is allowed. The only caller is an action built with
 * `defineAction`, which has already checked the role and counted the rate limit.
 */
export async function createMailTemplateStore(): Promise<MailTemplateStore> {
  return mailTemplateStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function mailTemplateStore(supabase: SupabaseClient<Database>): MailTemplateStore {
  return {
    async read(key) {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw mapMailTemplateError(error);
      return data?.value ?? null;
    },

    async write(key, value) {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value: value as NonNullable<Json> }, { onConflict: "key" });
      if (error) throw mapMailTemplateError(error);
    },
  };
}
