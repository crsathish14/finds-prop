/**
 * Which sponsored banners to show, and how (plan 04 section 5.2, UX homepage-ad-variations).
 * Pure functions with no framework code, so the rules are tested on their own. The data comes from
 * the admin sponsor settings (Stage 8); until then the Design Lab feeds it fixtures.
 *
 * The rules, in order, with no rotation:
 *  1. Keep an ad only if it is active, is meant for the placement, links to an https address,
 *     and has both pictures (desktop and compact) of the format the page layout needs.
 *  2. Check each picture against its slot. Within 8% of the slot shape it fills the slot ("cover");
 *     within 30% it is shown whole on a neutral background ("contain"); further off it is dropped.
 *  3. Nothing left: show nothing at all (no frame, no label, no gap).
 * With several banners left they slide in turn, SPONSOR_ROTATION_MS each (SponsorFrame).
 */
/** How long each banner stays before the next one slides in (owner decision, ADR-038). */
export const SPONSOR_ROTATION_MS = 5000;

/** The results list shows one sponsored banner after this many homes (the UX: after the sixth). */
export const RESULTS_SPONSOR_AFTER = 6;

export type SponsorFormat = "strip" | "panel";
export type SponsorPlacement = "hero" | "results";
export type HeroLayout = "search_desk" | "split";

export type SponsorImage = {
  src: string;
  width: number;
  height: number;
  /** Skip image optimisation (needed for SVG pictures such as the Design Lab samples). */
  unoptimized?: boolean;
};

export type SponsorCreatives = { desktop: SponsorImage; compact: SponsorImage };

export type SponsorAd = {
  id: string;
  active: boolean;
  placements: SponsorPlacement[];
  /** Required: the picture's description, which is also the link's name. */
  alt: string;
  href: string;
  strip?: SponsorCreatives;
  panel?: SponsorCreatives;
};

export type SponsorFit = "cover" | "contain" | "rejected";

export type SelectedSponsor = {
  id: string;
  alt: string;
  href: string;
  creatives: SponsorCreatives;
  /** "contain" when either picture needs to be shown whole. */
  fit: "cover" | "contain";
};

/** Shape (width / height) of the picture each slot is made for. */
export const SLOT_RATIOS = {
  strip: { desktop: 970 / 90, compact: 320 / 100 },
  panel: { desktop: 524 / 494, compact: 640 / 320 },
} as const satisfies Record<SponsorFormat, { desktop: number; compact: number }>;

const COVER_TOLERANCE = 0.08;
const CONTAIN_TOLERANCE = 0.3;

export function fitFor(image: SponsorImage, slotRatio: number): SponsorFit {
  if (image.width <= 0 || image.height <= 0) return "rejected";
  const difference = Math.abs(image.width / image.height / slotRatio - 1);
  if (difference <= COVER_TOLERANCE) return "cover";
  if (difference <= CONTAIN_TOLERANCE) return "contain";
  return "rejected";
}

/** The format a placement needs. Results lists always use the strip; the hero follows its layout. */
export function formatFor(placement: SponsorPlacement, layout: HeroLayout): SponsorFormat {
  if (placement === "results") return "strip";
  return layout === "split" ? "panel" : "strip";
}

export function selectSponsors({
  ads,
  placement,
  layout,
}: {
  ads: SponsorAd[];
  placement: SponsorPlacement;
  layout: HeroLayout;
}): { format: SponsorFormat; sponsors: SelectedSponsor[] } {
  const format = formatFor(placement, layout);
  const sponsors: SelectedSponsor[] = [];
  for (const ad of ads) {
    const creatives = ad[format];
    if (!ad.active || !ad.placements.includes(placement)) continue;
    if (!ad.href.startsWith("https://") || !ad.alt.trim() || !creatives) continue;
    const desktop = fitFor(creatives.desktop, SLOT_RATIOS[format].desktop);
    const compact = fitFor(creatives.compact, SLOT_RATIOS[format].compact);
    if (desktop === "rejected" || compact === "rejected") continue;
    sponsors.push({
      id: ad.id,
      alt: ad.alt,
      href: ad.href,
      creatives,
      fit: desktop === "contain" || compact === "contain" ? "contain" : "cover",
    });
  }
  return { format, sponsors };
}

/**
 * How the home page hero is arranged. The split layout needs a panel ad; with none the page falls
 * back to the Search Desk arrangement without a banner (UX section 4).
 */
export function resolveHero(
  ads: SponsorAd[],
  layout: HeroLayout,
): { arrangement: HeroLayout; format: SponsorFormat; sponsors: SelectedSponsor[] } {
  const { format, sponsors } = selectSponsors({ ads, placement: "hero", layout });
  if (layout === "split" && sponsors.length === 0) {
    return { arrangement: "search_desk", format: "strip", sponsors: [] };
  }
  return { arrangement: layout, format, sponsors };
}
