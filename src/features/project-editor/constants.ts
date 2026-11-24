/** What kind of project it is, as `projects.project_type` holds it (ADR-148: a plotted layout is a residential project of plots). */
export const PROJECT_TYPES = ["residential", "commercial"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** What is sold or let, as `projects.property_type` holds it. */
export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "plot",
  "vacant_land",
  "flat",
  "office",
  "co_working",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** The property types each project type offers (ADR-148). */
export const PROPERTY_TYPES_BY_PROJECT_TYPE: Record<ProjectType, readonly PropertyType[]> = {
  residential: ["apartment", "villa", "plot"],
  commercial: ["vacant_land", "flat", "office", "co_working", "villa"],
};

/** A commercial project is for sale or for rent, as `projects.offer_type` holds it. */
export const OFFER_TYPES = ["sale", "rent"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

/** What state a plot is sold in, as `projects.plot_status` holds it (ADR-160): asked for a plot only. */
export const PLOT_STATUSES = ["investment", "ready_to_build"] as const;
export type PlotStatus = (typeof PLOT_STATUSES)[number];

/** What kind of villa it is, as `projects.villa_type` holds it (ADR-160): asked for a villa only. */
export const VILLA_TYPES = ["duplex", "row_house", "individual"] as const;
export type VillaType = (typeof VILLA_TYPES)[number];

/** What the one price means, as `projects.price_type` holds it. */
export const SALE_PRICE_TYPES = ["per_sqft", "basic", "all_inclusive"] as const;
export const RENT_PRICE_TYPES = ["rent_per_month", "rent_per_sqft_month"] as const;
export const PRICE_TYPES = [...SALE_PRICE_TYPES, ...RENT_PRICE_TYPES] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

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
/**
 * The shape of a Tamil Nadu RERA number: TNRERA or TN, the district (digits), the kind of project (Layout, Building or BLG),
 * the serial (digits) and the year (4 digits), split by "/". For example TNRERA/29/BLG/0321/2026, TN/35/Layout/2645/2024,
 * TN/29/Building/0189/2023 (owner's samples, 24 Nov 2026).
 */
export const RERA_NUMBER_PATTERN = /^TN[A-Z]*\/\d+\/(?:Layout|Building|BLG)\/\d+\/(?:19|20)\d{2}$/i;
export const RERA_REASON_MAX = 300;
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
/** numeric(10, 2) */
export const AREA_SQFT_MAX = 99_999_999.99;

/** Price trends: months in the list, and the price per square foot the table accepts. */
export const TREND_MONTHS_MAX = 120;
export const TREND_PRICE_MIN = 1;
export const TREND_PRICE_MAX = 10_000_000;
