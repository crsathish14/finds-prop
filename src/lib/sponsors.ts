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
import type { PromotionDates } from "./promotion-dates";

/** How long each banner stays before the next one slides in (owner decision, ADR-038). */
export const SPONSOR_ROTATION_MS = 5000;

/** The results list shows one sponsored banner after this many homes (the UX: after the sixth). */
export const RESULTS_SPONSOR_AFTER = 6;

export type SponsorFormat = "strip" | "panel";
export type SponsorPlacement = "hero" | "results";
export type HeroLayout = "search_desk" | "split" | "conversational";

export type SponsorImage = {
  src: string;
  width: number;
  height: number;
  /** Skip image optimisation (needed for SVG pictures such as the Design Lab samples). */
  unoptimized?: boolean;
};

export type SponsorCreatives = { desktop: SponsorImage; compact: SponsorImage };

/**
 * How the hero ad under the search bar is drawn (sponsor ads plan, ADR-182): a Showcase card (A) or a Cinematic banner
 * (B). The admin chooses one for the whole site. The Split layout keeps its picture panel whatever is chosen.
 */
export const SPONSOR_STYLES = ["showcase", "cinematic"] as const;
export type SponsorStyle = (typeof SPONSOR_STYLES)[number];
export const DEFAULT_SPONSOR_STYLE: SponsorStyle = "showcase";

/** The Showcase card's facts about the project, as the admin typed them. */
export type SponsorShowcase = {
  project: string;
  locality: string;
  /** The homes on offer, such as "2 & 3 BHK". */
  homes: string;
  /** The price line, such as "₹78 L onwards". */
  price: string;
  size?: string;
  possession?: string;
  rera?: string;
};

/** The Cinematic banner's words, laid on the photo. */
export type SponsorCinematic = {
  eyebrow?: string;
  headline: string;
  line?: string;
  /** The button's words. */
  button: string;
};

export type SponsorAd = {
  id: string;
  active: boolean;
  placements: SponsorPlacement[];
  /** Required: the picture's description, which is also the link's name. */
  alt: string;
  /** Where a click goes: an https address of another site, or one of our project pages (`/projects/<slug>`). */
  href: string;
  /** False for one of our project pages; missing or true for another site's address (it opens in a new tab). */
  external?: boolean;
  /** The project a "project" link goes to, so its enquiry form can be opened. */
  projectSlug?: string;
  strip?: SponsorCreatives;
  panel?: SponsorCreatives;
  /** The developer or brand shown on the Showcase and Cinematic ads. */
  brand?: string;
  /** The one landscape photo both styles crop from. */
  photo?: SponsorImage;
  showcase?: SponsorShowcase;
  cinematic?: SponsorCinematic;
  /** The first and last day it runs (ADR-210), when the admin set them. */
  dates?: PromotionDates;
};

/** True when an ad has everything the chosen style draws: the photo, the brand and that style's words. */
export function readyFor(ad: SponsorAd, style: SponsorStyle): boolean {
  if (!ad.photo || !ad.brand?.trim()) return false;
  if (style === "showcase") {
    const facts = ad.showcase;
    return Boolean(
      facts?.project.trim() && facts.locality.trim() && facts.homes.trim() && facts.price.trim(),
    );
  }
  const words = ad.cinematic;
  return Boolean(words?.headline.trim() && words.button.trim());
}

/**
 * The hero ads to show in the chosen style, in the admin's order: active, meant for the hero and ready for the style.
 * An ad saved before the styles existed (pictures only) is left out until the admin completes it.
 */
export function selectStyled(ads: readonly SponsorAd[], style: SponsorStyle): SponsorAd[] {
  return ads.filter((ad) => ad.active && ad.placements.includes("hero") && readyFor(ad, style));
}

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
  strip: { desktop: 970 / 117, compact: 320 / 100 },
  panel: { desktop: 524 / 494, compact: 640 / 320 },
} as const satisfies Record<SponsorFormat, { desktop: number; compact: number }>;

const COVER_TOLERANCE = 0.08;
const CONTAIN_TOLERANCE = 0.31;

export function fitFor(image: SponsorImage, slotRatio: number): SponsorFit {
  if (image.width <= 0 || image.height <= 0) return "rejected";
  const difference = Math.abs(image.width / image.height / slotRatio - 1);
  if (difference <= COVER_TOLERANCE) return "cover";
  if (difference <= CONTAIN_TOLERANCE) return "contain";
  return "rejected";
}

/** The format a placement needs. Results lists always use the strip; the hero follows its layout (only Split uses the panel; Conversational uses the strip like Search Desk). */
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
