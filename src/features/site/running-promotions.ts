import { isRunning, type PromotionDates } from "@/lib/promotion-dates";
import type { SiteSettings } from "./schemas";

/**
 * The settings as the public site and the AI read them (ADR-210): every promotion the admin dated is kept only while it
 * runs today. A Sponsored builder, a Spotlight builder or a Top developer whose dates are not today leaves its list,
 * and a sponsor ad whose dates are not today leaves the ads. Undated ones stay, as before. Pure: the caller gives
 * today's India date. The admin pages read the whole lists with their dates instead (`readSiteContent`).
 */
export function runningPromotions(settings: SiteSettings, today: string): SiteSettings {
  const { sponsored_builders: sponsored, top_developers: top } = settings;
  const runs =
    (dates: Readonly<Record<string, PromotionDates>> = {}) =>
    (id: string) =>
      isRunning(dates[id], today);
  return {
    ...settings,
    sponsored_builders: {
      ...sponsored,
      featured: sponsored.featured.filter(runs(sponsored.featuredDates)),
      spotlight: sponsored.spotlight.filter(runs(sponsored.spotlightDates)),
    },
    top_developers: { ...top, builderIds: top.builderIds.filter(runs(top.dates)) },
    sponsors: {
      ...settings.sponsors,
      ads: settings.sponsors.ads.filter((ad) => isRunning(datesOfStoredAd(ad), today)),
    },
  };
}

/** The days of a stored ad, read loosely: the ad itself is checked later (`toSponsorAds`), so here a bad day is none. */
function datesOfStoredAd(ad: unknown): PromotionDates | undefined {
  if (typeof ad !== "object" || ad === null) return undefined;
  const { startsOn, endsOn } = ad as Record<string, unknown>;
  return {
    ...(typeof startsOn === "string" ? { startsOn } : {}),
    ...(typeof endsOn === "string" ? { endsOn } : {}),
  };
}
