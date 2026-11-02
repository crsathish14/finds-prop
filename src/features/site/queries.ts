import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { mergeSiteSettings } from "./merge";
import type { SiteSettings } from "./schemas";

/** Cache tag the admin site-content action will refresh when it saves (FR-ADM-10). */
export const SITE_SETTINGS_TAG = "site-settings";

/**
 * The site content with defaults applied. Public data, so it uses the cookie-less client and is
 * cached; a read that fails falls back to the defaults and is logged, so the site still renders.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase().from("site_settings").select("key, value");
  if (error) {
    logger.error("site settings could not be read, using the defaults", {
      errorCode: error.code,
    });
    return mergeSiteSettings([], logger);
  }
  return mergeSiteSettings(data, logger);
}
