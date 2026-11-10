import { selectSponsors, type HeroLayout, type SponsorAd, type SponsorFormat } from "./sponsors";

/**
 * How well the sponsors cover the home page hero in a layout, for the admin's Hero page (S7-T11, FR-ADM-11). It asks
 * the public site's own selection, so what the admin is told is what visitors get: a sponsor counts as able to show
 * when it is active, meant for the hero and has both pictures of the format the layout needs, each in a shape the
 * slot can fit. Only active sponsors are counted: one that is switched off is not expected to show. Pure: no
 * framework, so the rules are tested on their own.
 */
export type HeroCoverage = {
  /** The format the layout needs: a strip for Search Desk, a panel for Split. */
  format: SponsorFormat;
  /** The active sponsors. */
  active: number;
  /** The ids of the sponsors that can show in this layout, in the admin's order. */
  shown: string[];
  /** Active sponsors that cannot show in this layout. */
  missing: number;
};

export function heroCoverage(ads: readonly SponsorAd[], layout: HeroLayout): HeroCoverage {
  const { format, sponsors } = selectSponsors({ ads: [...ads], placement: "hero", layout });
  const active = ads.filter((ad) => ad.active).length;
  return {
    format,
    active,
    shown: sponsors.map((sponsor) => sponsor.id),
    missing: Math.max(0, active - sponsors.length),
  };
}
