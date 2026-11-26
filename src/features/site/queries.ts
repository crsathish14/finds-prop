import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { indiaToday } from "@/lib/india-days";
import { mergeSiteSettings } from "./merge";
import { runningPromotions } from "./running-promotions";
import { SITE_SETTING_KEYS, type SiteSettings } from "./schemas";

/** Cache tag the admin site-content action will refresh when it saves (FR-ADM-10). */
export const SITE_SETTINGS_TAG = CACHE_TAGS.siteSettings;

/**
 * The site content with defaults applied. Public data, so it uses the cookie-less client and is
 * cached; a read that fails falls back to the defaults and is logged, so the site still renders.
 * Only the promotions running today are kept (ADR-210); the cache lasts minutes, so a start or end date
 * reaches the site within minutes of midnight India time.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("minutes");

  // Only the keys the site reads: a legal page's row can be large and is read by its own query.
  const { data, error } = await createPublicSupabase()
    .from("site_settings")
    .select("key, value")
    .in("key", SITE_SETTING_KEYS);
  if (error) {
    logger.error("site settings could not be read, using the defaults", {
      errorCode: error.code,
    });
    return mergeSiteSettings([], logger);
  }
  return runningPromotions(mergeSiteSettings(data, logger), indiaToday(new Date()));
}
