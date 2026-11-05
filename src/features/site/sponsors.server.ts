import "server-only";
import type { SponsorAd } from "@/lib/sponsors";
import { publicEnv } from "@/lib/public-env";
import { logger } from "@/server/logger";
import { getSiteSettings } from "./queries";
import { toSponsorAds } from "./sponsors";

/**
 * The sponsored banners to offer a page: the site content's list (cached with the rest of it), each
 * checked on its own. With none stored, or none that fit, the list is empty and the page shows no
 * banner and leaves no gap (FR-PUB-03).
 */
export async function getSponsorAds(): Promise<SponsorAd[]> {
  const settings = await getSiteSettings();
  return toSponsorAds(settings.sponsors.ads, publicEnv.NEXT_PUBLIC_SUPABASE_URL, logger);
}
