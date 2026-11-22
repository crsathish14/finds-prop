import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LISTINGS_TAG } from "@/features/search";
import { propertyTag } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { z } from "zod";
import { labelSchema, photoRowSchema, propertyRowSchema, type PhotoRow } from "./schemas";
import type { PropertyData } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * What `public_property()` answers: the home's visitor columns, its photos and its label as one document.
 * Each part is checked on its own below, so one photo that does not fit is skipped, not an error.
 */
const documentSchema = z.object({
  property: z.unknown(),
  photos: z.array(z.unknown()),
  label: z.unknown(),
});

/**
 * One home as a visitor may see it, or "missing": no approved home has this id. `readAt` is when the
 * database was read (an ISO date and time, taken inside the cached read, so it is the time of the last
 * refill and not the time of the call); the AI assistant quotes it as "as of".
 */
export type PropertyResult =
  | { status: "found"; property: PropertyData; readAt: string }
  | { status: "missing"; readAt: string };

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
 * Reads one home by its public id through `public_property()`, as an anonymous visitor, so the database
 * decides what exists: only approved listings, only the visitor columns (BR-90). Nothing here can list
 * homes: the function answers one home or nothing. No home is `missing`, which
 * covers one that was never listed, one that is waiting for review and one that was sold or rented.
 * Anything else that goes wrong throws (and so is never cached): a failed read must not look like a
 * home that is gone. Errors are logged by their code only. Cached for minutes under the homes tag and the home's own tag,
 * so an approval, an edit or a sale refreshes it.
 */
export async function getProperty(shortId: string): Promise<PropertyResult> {
  "use cache";
  cacheTag(LISTINGS_TAG, propertyTag(shortId));
  cacheLife("minutes");
  const client = createPublicSupabase();
  const readAt = new Date().toISOString();

  const found = await client.rpc("public_property", { p_short_id: shortId });
  if (found.error) {
    logger.error("property could not be read", { errorCode: found.error.code });
    throw new Error("property could not be read");
  }
  if (found.data === null) return { status: "missing", readAt };
  const document = documentSchema.safeParse(found.data);
  if (!document.success) {
    logger.error("property row does not fit the expected shape", {});
    throw new Error("property row does not fit the expected shape");
  }
  const parsed = propertyRowSchema.safeParse(document.data.property);
  if (!parsed.success) {
    logger.error("property row does not fit the expected shape", {});
    throw new Error("property row does not fit the expected shape");
  }
  const row = parsed.data;

  const photos: PhotoRow[] = [];
  let skipped = 0;
  for (const item of document.data.photos) {
    const photo = photoRowSchema.safeParse(item);
    if (photo.success) photos.push(photo.data);
    else skipped += 1;
  }
  if (skipped > 0) {
    logger.warn("property photos skipped, they do not match the expected shape", { skipped });
  }

  return {
    status: "found",
    readAt,
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
      label: labelSchema.parse(document.data.label),
      ageDays: ageInDays(row.published_at, Date.now()),
      publishedAt: row.published_at,
      photos: inShowingOrder(photos).map((photo) => ({
        path: photo.storage_path,
        alt: photo.alt_text,
      })),
    },
  };
}
