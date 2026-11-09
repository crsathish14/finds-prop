import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeSiteSettings, type SiteSettings } from "@/features/site";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { EDITABLE_SETTINGS, type EditableSetting } from "./constants";

/**
 * What the Site content pages start from (S7-T10, FR-ADM-10): the settings as the public site would show them (the
 * saved values over the built-in defaults, BR-81), and which of the four have been saved at all. Read as the
 * signed-in admin and never cached: `getSiteSettings` of the public side keeps its answer for minutes, and an editor
 * must open on what was last saved. A failed read throws, so the error page shows it.
 */
export interface SiteContent {
  settings: SiteSettings;
  saved: Record<EditableSetting, boolean>;
}

/** The same read for any client (the integration tests pass the admin's). */
export async function readSiteContent(supabase: SupabaseClient<Database>): Promise<SiteContent> {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) {
    logger.error("the site content could not be read for the editor", { errorCode: error.code });
    throw error;
  }
  const saved = Object.fromEntries(
    EDITABLE_SETTINGS.map((key) => [key, data.some((row) => row.key === key)]),
  ) as Record<EditableSetting, boolean>;
  return { settings: mergeSiteSettings(data, logger), saved };
}

export async function getSiteContent(): Promise<SiteContent> {
  return readSiteContent(await createServerSupabase());
}
