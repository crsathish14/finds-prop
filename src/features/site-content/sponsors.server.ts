import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SPONSOR_BUCKET } from "@/features/site";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { mapContentError } from "./content-service";
import type { SponsorStore } from "./sponsor-service";

/**
 * The sponsors reach the database and the bucket here (S7-T11): as the signed-in admin through their cookies, so the
 * service role is not used and the policies decide what is allowed (only the super admin may write `site_settings` and
 * the `site-assets` bucket). The only caller is an action built with `defineAction`, which has already checked the role
 * and counted the rate limit.
 */
export async function createSponsorStore(): Promise<SponsorStore> {
  return sponsorStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function sponsorStore(supabase: SupabaseClient<Database>): SponsorStore {
  /** The stored `sponsors` setting as an object, or an empty one. */
  const readSetting = async (): Promise<Record<string, unknown>> => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "sponsors")
      .maybeSingle();
    if (error) throw mapContentError(error);
    const value = data?.value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value;
  };

  return {
    async readAds() {
      const { ads } = await readSetting();
      return Array.isArray(ads) ? ads : [];
    },

    async readStyle() {
      return (await readSetting()).style;
    },

    async isLiveProject(slug) {
      // The moderation columns are not readable by signed-in people (column grants), so ask the public projection,
      // which answers only for an approved, published project.
      const { data, error } = await supabase.rpc("public_project", { p_slug: slug });
      if (error) throw mapContentError(error);
      return data !== null;
    },

    async fetchImage(path) {
      const { data, error } = await supabase.storage.from(SPONSOR_BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },

    async write(ads, style) {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: "sponsors", value: { style, ads } as NonNullable<Json> },
          { onConflict: "key" },
        );
      if (error) throw mapContentError(error);
    },

    async removeFiles(paths) {
      const { error } = await supabase.storage.from(SPONSOR_BUCKET).remove([...paths]);
      if (error) throw new Error("The pictures could not be removed");
    },
  };
}
