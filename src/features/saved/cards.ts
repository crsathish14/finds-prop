import type { PropertyCardData } from "@/components/domain/property-card";
import { PROPERTY_TYPE_WORDS } from "@/config/search-options";
import { LISTING_BUCKET, publicStorageUrl } from "@/features/home";
import type { PropertyData } from "@/features/property";
import { formatListedAgo, type Translate } from "@/lib/format";

export type SavedCardContext = {
  translate: Translate;
  /** The address of the Supabase project (the public environment value). */
  supabaseUrl: string;
};

/**
 * A saved home as the property card takes it: the same card a results page draws, so the dashboard
 * looks like the search. The save control is given by the page, not by this data.
 */
export function toSavedCard(home: PropertyData, context: SavedCardContext): PropertyCardData {
  const cover = home.photos[0];
  return {
    href: `/properties/${home.slug}-${home.shortId}`,
    title: home.title,
    locality: home.locality ?? "",
    city: home.city ?? "",
    rupees: home.price,
    listingType: home.listingType,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    areaSqft: home.areaSqft,
    label: home.label,
    ...(home.ageDays === null
      ? {}
      : { listedAgo: formatListedAgo(context.translate, home.ageDays) }),
    typeLabel: context.translate(PROPERTY_TYPE_WORDS[home.propertyType]),
    cover: cover
      ? {
          src: publicStorageUrl(context.supabaseUrl, LISTING_BUCKET, cover.path),
          alt: cover.alt ?? "",
        }
      : null,
  };
}
