import { ActionError } from "@/server/actions/normalise-error";
import { OPEN_LISTING_LIMIT, STATE_NAME, TYPES_WITHOUT_BEDROOMS } from "./constants";
import type { DraftFields } from "./schemas";

/**
 * The rules of the post-property wizard's server side (S6-T02, FR-ACC-06, FR-ACC-08), apart from the code
 * that reaches the database so they can be tested with a stand-in. The real store is in `service.ts` and acts
 * as the signed-in owner, under Row Level Security: nothing here uses the service role. The database
 * holds the rules that must not be walked around (the five-listing limit, the move to Pending in
 * `submit_listing`, ADR-060); this file turns what it answers into the closed set of action errors.
 */

/** The columns the wizard writes, as the database names them. */
export interface DraftRow {
  listing_type?: string | null;
  property_type?: string | null;
  title?: string | null;
  description?: string | null;
  bhk?: number | null;
  bathrooms?: number | null;
  area_sqft?: number | null;
  price?: number | null;
  furnishing?: string | null;
  amenities?: string[];
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

/** Reads and writes made as the signed-in owner. */
export interface ListingCallerStore {
  /** Starts a draft owned by the caller (the owner comes from the session, not the row). */
  insertDraft(row: DraftRow): Promise<{ id: string; shortId: string }>;
  /** Changes a draft of the caller's; false when there is no such draft (not theirs, or no longer a draft). */
  updateDraft(listingId: string, row: DraftRow): Promise<boolean>;
  /** Deletes a draft of the caller's; false when there is none. */
  deleteDraft(listingId: string): Promise<boolean>;
  /** Calls `submit_listing`; returns the listing's short id. Throws the database's failure through `mapListingError`. */
  submit(listingId: string): Promise<string>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/** The wizard's field for each column `submit_listing` can name as missing. */
const FIELD_OF_COLUMN: Record<string, string> = {
  listing_type: "listingType",
  property_type: "propertyType",
  title: "title",
  price: "price",
  area_sqft: "areaSqft",
  address: "address",
  locality: "locality",
  city: "city",
  state: "state",
  pincode: "pincode",
};

/**
 * Turns what the database raises into the closed set of action errors. A listing that is not the caller's
 * looks the same as one that does not exist. A person at the limit and a listing with no photo are
 * validation problems the page can show next to the right place.
 */
export function mapListingError(failure: DatabaseFailure): ActionError {
  const { code, message, details } = failure;
  if (message === "properties.open_limit") {
    return new ActionError("VALIDATION", "The person already holds the most open listings", {
      fieldErrors: {
        listing: [{ key: "validation.openListingLimit", values: { maximum: OPEN_LISTING_LIMIT } }],
      },
    });
  }
  if (message === "listing.no_photo") {
    return new ActionError("VALIDATION", "The listing has no photo", {
      fieldErrors: { photos: [{ key: "validation.photoRequired" }] },
    });
  }
  if (message === "listing.incomplete") {
    const missing = (details ?? "")
      .split(",")
      .map((column) => FIELD_OF_COLUMN[column.trim()])
      .filter((field): field is string => field !== undefined);
    const fields = missing.length > 0 ? missing : ["listing"];
    return new ActionError("VALIDATION", "The listing is not complete", {
      fieldErrors: Object.fromEntries(
        fields.map((field) => [field, [{ key: "validation.required" }]]),
      ),
    });
  }
  if (message === "listing.not_found" || code === "P0002") {
    return new ActionError("NOT_FOUND", "The listing was not found");
  }
  if (message === "listing.not_submittable" || code === "55000") {
    return new ActionError("CONFLICT", "The listing cannot be submitted in its state");
  }
  if (message === "listing.not_allowed" || code === "42501") {
    return new ActionError("FORBIDDEN", "Posting a listing is not allowed for this account");
  }
  if (code === "23514") {
    // The database check that land and commercial space have no bedrooms is the one a draft can hit.
    const field = message?.includes("properties_no_bhk_for_land") ? "bhk" : "listing";
    return new ActionError("VALIDATION", "A value does not fit the listing's rules", {
      fieldErrors: { [field]: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The listing write failed");
}

/**
 * The wizard's fields as database columns. A field that is not given is left out (so it stays as it is);
 * one given as null clears the column. The state is always Tamil Nadu. Land and commercial space take no
 * bedrooms: choosing one of those types clears them.
 */
export function toDraftRow(fields: DraftFields): DraftRow {
  const row: DraftRow = { state: STATE_NAME };
  if (fields.listingType !== undefined) row.listing_type = fields.listingType;
  if (fields.propertyType !== undefined) row.property_type = fields.propertyType;
  if (fields.address !== undefined) row.address = fields.address;
  if (fields.locality !== undefined) row.locality = fields.locality;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.pincode !== undefined) row.pincode = fields.pincode;
  if (fields.bhk !== undefined) row.bhk = fields.bhk;
  if (fields.bathrooms !== undefined) row.bathrooms = fields.bathrooms;
  if (fields.areaSqft !== undefined) row.area_sqft = fields.areaSqft;
  if (fields.price !== undefined) row.price = fields.price;
  if (fields.furnishing !== undefined) row.furnishing = fields.furnishing;
  if (fields.amenities !== undefined) row.amenities = fields.amenities;
  if (fields.title !== undefined) row.title = fields.title;
  if (fields.description !== undefined) row.description = fields.description;
  if (
    typeof fields.propertyType === "string" &&
    TYPES_WITHOUT_BEDROOMS.includes(fields.propertyType)
  ) {
    row.bhk = null;
  }
  return row;
}

/** The first Continue: a new draft with what step 1 gave. */
export async function startDraft(
  store: ListingCallerStore,
  parameters: { fields: DraftFields },
): Promise<{ listingId: string; shortId: string }> {
  const { id, shortId } = await store.insertDraft(toDraftRow(parameters.fields));
  return { listingId: id, shortId };
}

/** A later Continue, or "Save draft": only a draft of the caller's can be changed. */
export async function keepDraft(
  store: ListingCallerStore,
  parameters: { listingId: string; fields: DraftFields },
): Promise<{ listingId: string }> {
  const updated = await store.updateDraft(parameters.listingId, toDraftRow(parameters.fields));
  if (!updated) throw new ActionError("NOT_FOUND", "The draft was not found");
  return { listingId: parameters.listingId };
}

/** Removes a draft. Its photo files are left to the sweeper (ADR-058). */
export async function discardDraft(
  store: ListingCallerStore,
  parameters: { listingId: string },
): Promise<{ listingId: string }> {
  const deleted = await store.deleteDraft(parameters.listingId);
  if (!deleted) throw new ActionError("NOT_FOUND", "The draft was not found");
  return { listingId: parameters.listingId };
}

/** Sends a draft for review. The database checks the owner, the fields, the photo and the limit. */
export async function sendForReview(
  store: ListingCallerStore,
  parameters: { listingId: string },
): Promise<{ listingId: string; shortId: string }> {
  const shortId = await store.submit(parameters.listingId);
  return { listingId: parameters.listingId, shortId };
}
