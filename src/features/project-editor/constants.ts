/** What kind of project it is, as `projects.project_type` holds it. */
export const PROJECT_TYPES = ["residential", "commercial", "plotted_layout"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Apartments or villas, as `projects.property_type` holds it. */
export const PROPERTY_TYPES = ["apartment", "villa"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Where the building work stands, as `projects.project_status` holds it. */
export const PROJECT_STATUSES = ["new_launch", "under_construction", "ready_to_move"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** The lengths and limits `projects` holds in the database (S7-T02). */
export const NAME_MIN = 2;
export const NAME_MAX = 140;
export const SLUG_MIN = 2;
export const SLUG_MAX = 80;
export const LOCALITY_MIN = 2;
export const LOCALITY_MAX = 80;
export const ADDRESS_MAX = 300;
export const DESCRIPTION_MAX = 5000;
export const SPECIFICATIONS_MAX = 5000;
export const RERA_NUMBER_MAX = 60;
export const SEO_TITLE_MAX = 120;
export const SEO_DESCRIPTION_MAX = 300;

/** How many tags each list holds, and how long one tag may be (the database holds the count, not the length). */
export const ADVANTAGES_MAX = 20;
export const NEARBY_MAX = 20;
export const AMENITIES_MAX = 30;
export const TAG_MAX = 80;

/** How many files each group of media holds, and the longest path or link. */
export const MEDIA_MAX = 20;
export const VIDEOS_MAX = 5;
export const MEDIA_PATH_MAX = 300;

/** Bedrooms the database accepts: 0 to 10. */
export const BHK_MIN = 0;
export const BHK_MAX = 10;

/** Prices in rupees, kept inside what a browser number holds exactly. */
export const PRICE_MAX = 100_000_000_000_000;
/** numeric(8, 2) */
export const ACRES_MAX = 999_999.99;
export const TOTAL_UNITS_MAX = 1_000_000;

/** Price trends: months in the list, and the price per square foot the table accepts. */
export const TREND_MONTHS_MAX = 120;
export const TREND_PRICE_MIN = 1;
export const TREND_PRICE_MAX = 10_000_000;
