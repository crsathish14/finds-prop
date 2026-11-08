import type { ListingStatus } from "@/lib/status-machine";

/**
 * The fields whose change sends a Live listing back to review (DEC-09, policy C), as the wizard names them. The
 * database decides this in `guard_properties` (title, description, listing type, property type, address and the
 * pin on a map); this mirrors it so the screen can warn the owner before saving. `IT-listing-edit` changes each
 * field of a Live listing against the real database and checks the two agree. The pin is not here because the
 * wizard has no map yet.
 */
export const MODERATED_FIELDS = [
  "listingType",
  "propertyType",
  "title",
  "description",
  "address",
] as const;
export type ModeratedField = (typeof MODERATED_FIELDS)[number];

export type ModeratedValues = Record<ModeratedField, string | null | undefined>;

/** What the database would hold: ends trimmed, runs of spaces one space (line breaks kept), blank is nothing. */
function stored(field: ModeratedField, value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = field === "description" ? value.trim() : value.trim().replace(/[ \t]+/g, " ");
  return text === "" ? null : text;
}

/** The moderated fields whose value differs between what the listing holds and what the owner has now. */
export function changedModeratedFields(
  before: Partial<ModeratedValues>,
  after: Partial<ModeratedValues>,
): ModeratedField[] {
  return MODERATED_FIELDS.filter(
    (field) => stored(field, before[field]) !== stored(field, after[field]),
  );
}

/**
 * Whether saving these edits sends the listing back to review: only a Live listing does, and only when a
 * moderated field changed. A listing in review or not approved stays where it is (it is not public), and a change
 * of price, area, bedrooms, amenities, furnishing or place keeps a Live listing Live.
 */
export function changesNeedReview(
  status: ListingStatus,
  before: Partial<ModeratedValues>,
  after: Partial<ModeratedValues>,
): boolean {
  return status === "approved" && changedModeratedFields(before, after).length > 0;
}
