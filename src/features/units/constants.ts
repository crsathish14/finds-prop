/** The states a unit can be in, as `project_units.status` holds them. */
export const UNIT_STATUSES = ["available", "hold", "sold", "blocked"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** The state chips above the list: every state, or one. */
export const UNIT_STATE_FILTERS = ["all", ...UNIT_STATUSES] as const;
export type UnitStateFilter = (typeof UNIT_STATE_FILTERS)[number];

/**
 * The directions a unit can face, as the form sends them (lower case). The database holds the words under
 * `FACING_WORDS`, as the public project page shows them.
 */
export const UNIT_FACINGS = [
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
  "south",
  "south-east",
] as const;
export type UnitFacing = (typeof UNIT_FACINGS)[number];

export const FACING_WORDS: Record<UnitFacing, string> = {
  east: "East",
  "north-east": "North-east",
  north: "North",
  "north-west": "North-west",
  west: "West",
  "south-west": "South-west",
  south: "South",
  "south-east": "South-east",
};

/** The limits `project_units` holds in the database (and a little sense on top for the price). */
export const UNIT_NUMBER_MAX = 30;
export const FLOOR_MIN = -5;
export const FLOOR_MAX = 200;
export const BHK_MIN = 0;
export const BHK_MAX = 10;
/** numeric(10, 2) */
export const AREA_MAX = 99_999_999.99;
/** A price in rupees; a bigint column, kept inside what a browser number holds exactly. */
export const PRICE_MAX = 100_000_000_000_000;
export const FLOOR_PLAN_LINK_MAX = 300;

/** Units on one page of the admin's list. */
export const UNITS_PAGE_SIZE = 25;
export const UNIT_SEARCH_MAX = 30;
