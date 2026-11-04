import { Building2, Columns2, MapPin, MessageCircle, ShieldCheck, Star, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CategoryTint } from "@/components/domain/category-card";
import { tintAt, type LocalityTint } from "@/components/domain/locality-tile";
import { buildSearchHref, placeParams, SEARCH_PATH, type CuratedLocality } from "@/features/search";
import type { Translate } from "@/lib/format";

/** One locality tile of "Explore by locality": the curated place, where it leads and its tint. */
export type ExploreTile = { key: string; name: string; href: string; tint: LocalityTint };

/**
 * The tiles for the curated localities of the site content (DEC-13), in their order: each leads to
 * the homes around that place, and the tints go round the five of the UX. There is no line under
 * the name yet (the UX's "Apartments · Villas" needs a count for each locality).
 */
export function buildExploreTiles(localities: readonly CuratedLocality[]): ExploreTile[] {
  return localities.map((place, index) => ({
    key: `${index}-${place.label}`,
    name: place.label,
    href: buildSearchHref(placeParams(place)),
    tint: tintAt(index),
  }));
}

/** One card of "Browse by what matters". */
export type BrowseCard = {
  key: "featured" | "prime" | "budget" | "locality";
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  tint: CategoryTint;
};

/**
 * The four cards: Featured, Prime and Budget lead to the homes with that label (BR-92) and By locality
 * to the results page. The line of the last one names the region when the site content has one and
 * names no place otherwise (DEC-14).
 */
export function buildBrowseCards(
  translate: Translate,
  regionName?: string | undefined,
): BrowseCard[] {
  const region = regionName?.trim();
  return [
    {
      key: "featured",
      icon: Star,
      title: translate("home.browse.featured.title"),
      description: translate("home.browse.featured.description"),
      href: buildSearchHref({ label: "featured" }),
      tint: 1,
    },
    {
      key: "prime",
      icon: Building2,
      title: translate("home.browse.prime.title"),
      description: translate("home.browse.prime.description"),
      href: buildSearchHref({ label: "prime" }),
      tint: 2,
    },
    {
      key: "budget",
      icon: Tag,
      title: translate("home.browse.budget.title"),
      description: translate("home.browse.budget.description"),
      href: buildSearchHref({ label: "budget" }),
      tint: 3,
    },
    {
      key: "locality",
      icon: MapPin,
      title: translate("home.browse.locality.title"),
      description: region
        ? translate("home.browse.locality.descriptionInRegion", { region })
        : translate("home.browse.locality.description"),
      href: SEARCH_PATH,
      tint: 4,
    },
  ];
}

/** One card of "Why Find Prop". */
export type ValueCardModel = {
  key: "approved" | "enquire" | "compare";
  icon: LucideIcon;
  title: string;
  description: string;
};

/** The three reasons, in the UX's words, with the brand name in the first. */
export function buildValueCards(translate: Translate, brandName: string): ValueCardModel[] {
  return [
    {
      key: "approved",
      icon: ShieldCheck,
      title: translate("home.why.approved.title"),
      description: translate("home.why.approved.description", { brandName }),
    },
    {
      key: "enquire",
      icon: MessageCircle,
      title: translate("home.why.enquire.title"),
      description: translate("home.why.enquire.description"),
    },
    {
      key: "compare",
      icon: Columns2,
      title: translate("home.why.compare.title"),
      description: translate("home.why.compare.description"),
    },
  ];
}
