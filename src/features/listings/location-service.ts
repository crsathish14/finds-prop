import { ActionError } from "@/server/actions/normalise-error";
import { mapListingError, type DatabaseFailure } from "./listing-service";
import type { SetListingLocationInput } from "./schemas";

/**
 * The rules of setting a listing's location (place search PR 7b, ADR-141), apart from the code that reaches the
 * database so they can be tested with a stand-in. The real store is in `location-store.ts` and acts as the
 * signed-in owner. The database holds the rules that must not be walked around (who owns the listing, that the
 * point lies inside the region, that a sold or rented listing is closed, ADR-138); this file turns what it
 * answers into the closed set of action errors. No message or log line here ever holds the point: the numbers
 * are the owner's private location (DEC-35).
 */

/** Calls made as the signed-in owner. */
export interface ListingLocationStore {
  /** The caller's own listing as it is now, or null when it is not theirs or does not exist. */
  current(listingId: string): Promise<{ shortId: string; status: string } | null>;
  /** Calls `set_listing_location`; the listing's status afterwards. Throws through `mapLocationError`. */
  setLocation(listingId: string, lat: number, lng: number): Promise<string>;
}

/** What setting the location came to. */
export interface LocationSet {
  listingId: string;
  shortId: string;
  /** The state after the change. */
  status: string;
  /** True when a Live listing was sent back to review by this change (DEC-09, policy C). */
  wentBackToReview: boolean;
}

/**
 * What `set_listing_location` raises, as the closed set of action errors. A point outside the region, or one that
 * is not a real point, is a validation problem on the `location` field (the place, not the numbers: the owner
 * never saw a latitude). Everything else is what the wizard's other writes already map (a listing that is not
 * the caller's is `NOT_FOUND`, a sold or rented listing is a conflict, no verified phone is forbidden).
 */
export function mapLocationError(failure: DatabaseFailure): ActionError {
  if (failure.message === "listing.location_out_of_region") {
    return new ActionError("VALIDATION", "The place is outside the region", {
      fieldErrors: { location: [{ key: "validation.locationOutOfRegion" }] },
    });
  }
  if (failure.message === "listing.location_invalid" || failure.code === "22023") {
    return new ActionError("VALIDATION", "The place is not a valid point", {
      fieldErrors: { location: [{ key: "validation.invalid" }] },
    });
  }
  if (failure.message === "listing.not_editable") {
    return new ActionError("CONFLICT", "A sold or rented listing cannot be changed");
  }
  return mapListingError(failure);
}

/**
 * Sets where the caller's listing is. Someone else's listing and one that does not exist look the same
 * (`NOT_FOUND`), and are found before the database is asked to store anything. The database may send a Live
 * listing back to review (policy C), and the answer says so.
 */
export async function setOwnLocation(
  store: ListingLocationStore,
  input: SetListingLocationInput,
): Promise<LocationSet> {
  const found = await store.current(input.listingId);
  if (!found) throw new ActionError("NOT_FOUND", "The listing was not found");
  const status = await store.setLocation(input.listingId, input.lat, input.lng);
  return {
    listingId: input.listingId,
    shortId: found.shortId,
    status,
    wentBackToReview: found.status === "approved" && status === "pending",
  };
}
