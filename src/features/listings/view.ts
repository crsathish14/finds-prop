import { z } from "zod";
import { AMENITY_OPTIONS, FURNISHINGS, LISTING_TYPES, PROPERTY_TYPES } from "./constants";
import type { Amenity, Furnishing, ListingType, PropertyType } from "./constants";

/**
 * A draft as the wizard shows it when the owner comes back to it (S6-T02, FR-ACC-08): every field the
 * wizard fills, each one or null, and the photos the draft already has. A value the wizard would not have
 * written (an old listing, a hand-edited row) reads as empty, so the form starts blank for that field
 * instead of failing. Rows are the owner's own, read through `my_properties()`.
 */
export interface DraftPhoto {
  id: string;
  /** Where the file is in the `listing-photos` bucket; the page builds the address from it. */
  path: string;
  position: number;
}

export interface DraftView {
  id: string;
  shortId: string;
  status: string;
  listingType: ListingType | null;
  propertyType: PropertyType | null;
  address: string | null;
  locality: string | null;
  city: string | null;
  pincode: string | null;
  bhk: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  price: number | null;
  furnishing: Furnishing | null;
  amenities: Amenity[];
  title: string | null;
  description: string | null;
  updatedAt: string;
  photos: DraftPhoto[];
}

/** One line of "Your drafts". */
export interface DraftSummary {
  id: string;
  title: string | null;
  locality: string | null;
  propertyType: PropertyType | null;
  listingType: ListingType | null;
  updatedAt: string;
}

/** The columns read for a draft (never the location or the moderation columns). */
export const DRAFT_COLUMNS =
  "id, short_id, status, listing_type, property_type, address, locality, city, pincode, bhk, bathrooms, area_sqft, price, furnishing, amenities, title, description, updated_at";

export const DRAFT_SUMMARY_COLUMNS = "id, title, locality, property_type, listing_type, updated_at";

const known = <T extends readonly string[]>(list: T, value: unknown): T[number] | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? value : null;

const draftRowSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  status: z.string(),
  listing_type: z.string().nullable(),
  property_type: z.string().nullable(),
  address: z.string().nullable(),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  pincode: z.string().nullable(),
  bhk: z.number().nullable(),
  bathrooms: z.number().nullable(),
  area_sqft: z.number().nullable(),
  price: z.number().nullable(),
  furnishing: z.string().nullable(),
  amenities: z.array(z.string()),
  title: z.string().nullable(),
  description: z.string().nullable(),
  updated_at: z.string(),
});

const photoRowSchema = z.object({ id: z.string(), storage_path: z.string(), position: z.number() });

const summaryRowSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  locality: z.string().nullable(),
  property_type: z.string().nullable(),
  listing_type: z.string().nullable(),
  updated_at: z.string(),
});

/** Pure: one draft row and its photo rows into the wizard's view, or null when the row is not shaped as a listing. */
export function toDraftView(row: unknown, photoRows: readonly unknown[]): DraftView | null {
  const parsed = draftRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const draft = parsed.data;
  const photos = photoRows.flatMap((photo) => {
    const found = photoRowSchema.safeParse(photo);
    return found.success
      ? [{ id: found.data.id, path: found.data.storage_path, position: found.data.position }]
      : [];
  });
  photos.sort((first, second) => first.position - second.position);
  return {
    id: draft.id,
    shortId: draft.short_id,
    status: draft.status,
    listingType: known(LISTING_TYPES, draft.listing_type),
    propertyType: known(PROPERTY_TYPES, draft.property_type),
    address: draft.address,
    locality: draft.locality,
    city: draft.city,
    pincode: draft.pincode,
    bhk: draft.bhk,
    bathrooms: draft.bathrooms,
    areaSqft: draft.area_sqft,
    price: draft.price,
    furnishing: known(FURNISHINGS, draft.furnishing),
    amenities: draft.amenities.filter((item): item is Amenity =>
      (AMENITY_OPTIONS as readonly string[]).includes(item),
    ),
    title: draft.title,
    description: draft.description,
    updatedAt: draft.updated_at,
    photos,
  };
}

/** Pure: the rows of "Your drafts", rows that are not shaped as a listing left out. */
export function toDraftSummaries(rows: readonly unknown[]): DraftSummary[] {
  return rows.flatMap((row) => {
    const parsed = summaryRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const draft = parsed.data;
    return [
      {
        id: draft.id,
        title: draft.title,
        locality: draft.locality,
        propertyType: known(PROPERTY_TYPES, draft.property_type),
        listingType: known(LISTING_TYPES, draft.listing_type),
        updatedAt: draft.updated_at,
      },
    ];
  });
}

/** The states a listing outside the drafts can be in, as the dashboard lists them. */
export const MY_LISTING_STATUSES = ["pending", "approved", "rejected", "sold", "rented"] as const;
export type MyListingStatus = (typeof MY_LISTING_STATUSES)[number];

/** One line of "My listings" on the dashboard (S6-T03, FR-ACC-09), ready to draw. */
export interface MyListing {
  id: string;
  shortId: string;
  slug: string;
  status: MyListingStatus;
  listingType: ListingType | null;
  propertyType: PropertyType | null;
  title: string | null;
  price: number | null;
  locality: string | null;
  /** Why an admin did not approve it; set only while the listing is rejected. */
  rejectionReason: string | null;
  createdAt: string;
  /** The address of the first photo, or null when it has none. */
  coverUrl: string | null;
}

/** The columns read for "My listings". */
export const MY_LISTING_COLUMNS =
  "id, short_id, slug, status, listing_type, property_type, title, price, locality, rejection_reason, created_at";

const myListingRowSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  slug: z.string(),
  status: z.enum(MY_LISTING_STATUSES),
  listing_type: z.string().nullable(),
  property_type: z.string().nullable(),
  title: z.string().nullable(),
  price: z.number().nullable(),
  locality: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  created_at: z.string(),
});

const coverRowSchema = z.object({
  listing_id: z.string(),
  storage_path: z.string(),
  position: z.number(),
});

/**
 * Pure: the owner's listing rows and their photo rows into the lines of "My listings", in the order the rows
 * came. A row that is not shaped as a listing (a draft, an unknown state) is left out, and each listing's
 * cover is its first photo by position. `coverAddress` turns a path in the photo bucket into an address.
 */
export function toMyListings(
  rows: readonly unknown[],
  photoRows: readonly unknown[],
  coverAddress: (path: string) => string,
): MyListing[] {
  const firstPhoto = new Map<string, { path: string; position: number }>();
  for (const photo of photoRows) {
    const found = coverRowSchema.safeParse(photo);
    if (!found.success) continue;
    const seen = firstPhoto.get(found.data.listing_id);
    if (!seen || found.data.position < seen.position) {
      firstPhoto.set(found.data.listing_id, {
        path: found.data.storage_path,
        position: found.data.position,
      });
    }
  }
  return rows.flatMap((row) => {
    const parsed = myListingRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const listing = parsed.data;
    const cover = firstPhoto.get(listing.id);
    return [
      {
        id: listing.id,
        shortId: listing.short_id,
        slug: listing.slug,
        status: listing.status,
        listingType: known(LISTING_TYPES, listing.listing_type),
        propertyType: known(PROPERTY_TYPES, listing.property_type),
        title: listing.title,
        price: listing.price,
        locality: listing.locality,
        rejectionReason: listing.status === "rejected" ? listing.rejection_reason : null,
        createdAt: listing.created_at,
        coverUrl: cover ? coverAddress(cover.path) : null,
      },
    ];
  });
}
