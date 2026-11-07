import { z } from "zod";
import { publicStorageUrl } from "@/lib/storage-url";
import {
  LISTING_STATUSES,
  QUEUE_KINDS,
  type ListingStatus,
  type QueueKind,
  type QueueTab,
} from "./constants";

/**
 * The admin's queue as the screens take it (S6-T04, FR-ADM-02): rows of `admin_listing_queue` turned into
 * view models, and the page cursor. A row that is not shaped as a listing is left out rather than breaking the
 * page; the query counts them so the log shows it. Everything here is pure.
 */

/** The bucket the listing photos are in (public, ADR-058). */
const PHOTO_BUCKET = "listing-photos";

export interface QueuePhoto {
  id: string;
  url: string;
  position: number;
}

/** One listing in the queue, with everything the review drawer shows. */
export interface QueueItem {
  id: string;
  shortId: string;
  status: ListingStatus;
  featured: boolean;
  listingType: QueueKind | null;
  /** Kept as the database holds it: the drawer prints it through the site's own list. */
  propertyType: string | null;
  title: string | null;
  description: string | null;
  bhk: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  price: number | null;
  furnishing: string | null;
  amenities: string[];
  address: string | null;
  locality: string | null;
  city: string | null;
  pincode: string | null;
  /** Why it was rejected, for a rejected listing. */
  rejectionReason: string | null;
  submittedAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  photos: QueuePhoto[];
}

export interface QueuePage {
  items: QueueItem[];
  /** The cursor for "Show more", or null when this is the last page. */
  nextCursor: string | null;
  /** Rows the database sent that could not be read (shown in the log, never to the admin). */
  skipped: number;
}

/** The numbers on the tabs and in the sidebar. */
export interface QueueCounts {
  pending: number;
  approved: number;
  rejected: number;
  closed: number;
  total: number;
}

export const EMPTY_COUNTS: QueueCounts = {
  pending: 0,
  approved: 0,
  rejected: 0,
  closed: 0,
  total: 0,
};

/** The tab's count, for the label on the tab. */
export function countForTab(counts: QueueCounts, tab: QueueTab): number {
  return tab === "all" ? counts.total : counts[tab];
}

const photoSchema = z.object({ id: z.string(), path: z.string(), position: z.number() });

const rowSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  status: z.enum(LISTING_STATUSES),
  featured: z.boolean(),
  listing_type: z.string().nullable(),
  property_type: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  bhk: z.number().nullable(),
  bathrooms: z.number().nullable(),
  area_sqft: z.number().nullable(),
  price: z.number().nullable(),
  furnishing: z.string().nullable(),
  amenities: z.array(z.string()).nullable(),
  address: z.string().nullable(),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  pincode: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  submitted_at: z.string(),
  owner_name: z.string().nullable(),
  owner_email: z.string().nullable(),
  photos: z.unknown(),
});

const counts = z.object({
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
  closed: z.number(),
  total: z.number(),
});

const known = <T extends readonly string[]>(list: T, value: unknown): T[number] | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? value : null;

/** Pure: the photo rows of one listing, in order, with the address of each file. */
function toPhotos(value: unknown, supabaseUrl: string): QueuePhoto[] {
  if (!Array.isArray(value)) return [];
  const photos = value.flatMap((photo) => {
    const found = photoSchema.safeParse(photo);
    return found.success
      ? [
          {
            id: found.data.id,
            url: publicStorageUrl(supabaseUrl, PHOTO_BUCKET, found.data.path),
            position: found.data.position,
          },
        ]
      : [];
  });
  photos.sort((first, second) => first.position - second.position);
  return photos;
}

/** Pure: the rows of one page into view models, rows that are not shaped as a listing left out and counted. */
export function toQueueItems(
  rows: readonly unknown[] | null,
  supabaseUrl: string,
): { items: QueueItem[]; skipped: number } {
  const items: QueueItem[] = [];
  let skipped = 0;
  for (const row of rows ?? []) {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const listing = parsed.data;
    items.push({
      id: listing.id,
      shortId: listing.short_id,
      status: listing.status,
      featured: listing.featured,
      listingType: known(QUEUE_KINDS, listing.listing_type),
      propertyType: listing.property_type,
      title: listing.title,
      description: listing.description,
      bhk: listing.bhk,
      bathrooms: listing.bathrooms,
      areaSqft: listing.area_sqft,
      price: listing.price,
      furnishing: listing.furnishing,
      amenities: listing.amenities ?? [],
      address: listing.address,
      locality: listing.locality,
      city: listing.city,
      pincode: listing.pincode,
      rejectionReason: listing.rejection_reason,
      submittedAt: listing.submitted_at,
      ownerName: listing.owner_name,
      ownerEmail: listing.owner_email,
      photos: toPhotos(listing.photos, supabaseUrl),
    });
  }
  return { items, skipped };
}

/** Pure: the counts row into view numbers; an answer that is not shaped as counts reads as zeros. */
export function toCounts(rows: readonly unknown[] | null): QueueCounts {
  const parsed = counts.safeParse(rows?.[0]);
  return parsed.success ? parsed.data : EMPTY_COUNTS;
}

/** Pure: the locality rows into a clean list, blanks left out. */
export function toLocalities(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is string => typeof row === "string" && row.trim() !== "");
}
