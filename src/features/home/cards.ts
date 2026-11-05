import type { DeveloperCardData } from "@/components/domain/developer-card";
import type { PropertyCardData } from "@/components/domain/property-card";
import { PROPERTY_TYPES, PROPERTY_TYPE_WORDS, type PropertyType } from "@/config/search-options";
import { formatListedAgo, type Translate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage-url";
import type { DeveloperRow, ListingRow } from "./schemas";

/** The two public storage buckets the pictures come from (the images in next.config allow both). */
export const LISTING_BUCKET = "listing-photos";
export const PROJECT_BUCKET = "project-media";

/** The address of a picture in a public bucket (see `lib/storage-url.ts`). */
export { publicStorageUrl };

export type CardContext = {
  translate: Translate;
  /** The address of the Supabase project (the public environment value). */
  supabaseUrl: string;
};

function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

/**
 * A home as the property card takes it. The address is `/properties/{slug}-{shortId}` (ADR-025). The
 * kind of property is shown only when this site knows it, and the picture only when the home has one.
 * Save and Compare are not part of the data: the page gives the card those controls (S5-T01, S4-T02).
 */
export function toPropertyCard(row: ListingRow, context: CardContext): PropertyCardData {
  return {
    href: `/properties/${row.slug}-${row.short_id}`,
    title: row.title,
    locality: row.locality ?? "",
    city: row.city ?? "",
    rupees: row.price,
    listingType: row.listing_type,
    bedrooms: row.bhk,
    bathrooms: row.bathrooms,
    areaSqft: row.area_sqft,
    label: row.label,
    ...(row.ageDays === null ? {} : { listedAgo: formatListedAgo(context.translate, row.ageDays) }),
    ...(isPropertyType(row.property_type)
      ? { typeLabel: context.translate(PROPERTY_TYPE_WORDS[row.property_type]) }
      : {}),
    cover: row.cover_path
      ? {
          src: publicStorageUrl(context.supabaseUrl, LISTING_BUCKET, row.cover_path),
          alt: row.cover_alt ?? "",
        }
      : null,
  };
}

const DEVELOPER_TINTS = ["green", "copper", "sand"] as const;

/** A developer as the developer card takes it; the tint goes round green, copper, sand. */
export function toDeveloperCard(
  row: DeveloperRow,
  index: number,
  supabaseUrl: string,
): DeveloperCardData {
  const about = row.description?.trim();
  return {
    name: row.name,
    tint: DEVELOPER_TINTS[Math.abs(index) % DEVELOPER_TINTS.length] ?? "green",
    projectCount: row.projectCount,
    ...(about ? { about } : {}),
    projects: row.projects.map((project) => ({
      href: `/projects/${project.slug}`,
      name: project.name,
      cover: project.coverPath
        ? publicStorageUrl(supabaseUrl, PROJECT_BUCKET, project.coverPath)
        : null,
    })),
  };
}
