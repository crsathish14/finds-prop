/**
 * The fixed lists and limits of the post-property wizard (S6-T02, FR-ACC-06). The lengths and ranges are
 * the ones `properties` holds in the database; the screen and the server read them from here.
 */
export const LISTING_TYPES = ["sale", "rent"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const PROPERTY_TYPES = ["apartment", "villa", "house", "plot", "commercial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Land and commercial space have no bedrooms (the database refuses a bhk for them). */
export const TYPES_WITHOUT_BEDROOMS: readonly PropertyType[] = ["plot", "commercial"];

export const FURNISHINGS = ["unfurnished", "semi", "full"] as const;
export type Furnishing = (typeof FURNISHINGS)[number];

/**
 * The twelve amenities the screen offers, stored as these words (the property page prints what the owner
 * stored). The database allows up to 20; only these are accepted until editing is built (S6-T05).
 */
export const AMENITY_OPTIONS = [
  "Gym",
  "Swimming Pool",
  "24x7 Security",
  "Car Park",
  "Lift",
  "Power Backup",
  "Children Play Area",
  "Clubhouse",
  "Modular Kitchen",
  "Fully Furnished",
  "Near Metro",
  "Near Beach",
] as const;
export type Amenity = (typeof AMENITY_OPTIONS)[number];

export const TITLE_MIN = 8;
export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 5000;
export const ADDRESS_MAX = 300;
export const LOCALITY_MIN = 2;
export const LOCALITY_MAX = 80;
export const CITY_MAX = 80;
export const BATHROOMS_MAX = 10;
export const BHK_MAX = 10;
/** `area_sqft` is numeric(10, 2): below one hundred million square feet. */
export const AREA_MAX = 99_999_999;
/** A price in rupees; the column is a bigint, this keeps a mistyped zero from reaching it. */
export const PRICE_MAX = 100_000_000_000;

/** Only Tamil Nadu for now (addendum ADD-08); the screen shows it read-only. */
export const STATE_NAME = "Tamil Nadu";

/** The most draft plus pending listings one person may hold (DEC-26; the database setting `listings.max_open`). */
export const OPEN_LISTING_LIMIT = 5;

/** The most drafts the "Your drafts" list reads. */
export const DRAFTS_LIMIT = 10;
