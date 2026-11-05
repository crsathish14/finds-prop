import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG } from "@/features/search";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import {
  labelSchema,
  photoRowSchema,
  PHOTO_COLUMNS,
  propertyRowSchema,
  PROPERTY_COLUMNS,
  type PhotoRow,
} from "./schemas";
import type { PropertyData } from "./types";

const MS_PER_DAY = 86_400_000;

/** One home as a visitor may see it, or "missing": no approved home has this id. */
export type PropertyResult = { status: "found"; property: PropertyData } | { status: "missing" };

function ageInDays(publishedAt: string | null, now: number): number | null {
  if (publishedAt === null) return null;
  const then = Date.parse(publishedAt);
  return Number.isNaN(then) ? null : Math.floor((now - then) / MS_PER_DAY);
}

/** The cover first, then the photos in their order. */
function inShowingOrder(photos: PhotoRow[]): PhotoRow[] {
  return [...photos].sort(
    (first, second) =>
      Number(second.is_cover) - Number(first.is_cover) || first.position - second.position,
  );
}

/**
 * Reads one home by its public id, as an anonymous visitor, so the database's own rules decide what
 * exists: only approved listings, only the granted columns (BR-90). No home is `missing`, which
 * covers one that was never listed, one that is waiting for review and one that was sold or rented.
 * Anything else that goes wrong throws (and so is never cached): a failed read must not look like a
 * home that is gone. Errors are logged by their code only. Cached for minutes under the homes tag, so
 * an approval or an edit refreshes it.
 */
export async function getProperty(shortId: string): Promise<PropertyResult> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();

  const found = await client
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("short_id", shortId)
    .maybeSingle();
  if (found.error) {
    logger.error("property could not be read", { errorCode: found.error.code });
    throw new Error("property could not be read");
  }
  if (found.data === null) return { status: "missing" };
  const parsed = propertyRowSchema.safeParse(found.data);
  if (!parsed.success) {
    logger.error("property row does not fit the expected shape", {});
    throw new Error("property row does not fit the expected shape");
  }
  const row = parsed.data;

  const [media, label] = await Promise.all([
    client
      .from("listing_media")
      .select(PHOTO_COLUMNS)
      .eq("listing_id", row.id)
      .order("position", { ascending: true }),
    client.rpc("listing_label", {
      listing_price: row.price,
      listing_kind: row.listing_type,
      is_featured: row.featured,
    }),
  ]);
  if (media.error || label.error) {
    logger.error("property photos or label could not be read", {
      errorCode: media.error?.code ?? label.error?.code ?? "",
    });
    throw new Error("property photos or label could not be read");
  }

  const photos: PhotoRow[] = [];
  let skipped = 0;
  for (const item of media.data ?? []) {
    const photo = photoRowSchema.safeParse(item);
    if (photo.success) photos.push(photo.data);
    else skipped += 1;
  }
  if (skipped > 0) {
    logger.warn("property photos skipped, they do not match the expected shape", { skipped });
  }

  return {
    status: "found",
    property: {
      id: row.id,
      shortId: row.short_id,
      slug: row.slug,
      listingType: row.listing_type,
      propertyType: row.property_type,
      title: row.title,
      description: row.description,
      bedrooms: row.bhk,
      bathrooms: row.bathrooms,
      areaSqft: row.area_sqft,
      price: row.price,
      furnishing: row.furnishing,
      amenities: row.amenities,
      availableFrom: row.available_from,
      locality: row.locality,
      city: row.city,
      state: row.state,
      featured: row.featured,
      label: labelSchema.parse(label.data),
      ageDays: ageInDays(row.published_at, Date.now()),
      photos: inShowingOrder(photos).map((photo) => ({
        path: photo.storage_path,
        alt: photo.alt_text,
      })),
    },
  };
}
