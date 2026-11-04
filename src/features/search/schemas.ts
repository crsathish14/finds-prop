import { z } from "zod";
import { PROPERTY_TYPES, SORT_OPTIONS } from "@/config/search-options";

/**
 * The search address contract: what `/properties` accepts in its address (docs/engineering/frontend.md
 * section 6.1, names from Phase 1, BR-91). Zod only, no framework code, so the same rules run on the
 * server (parsing `searchParams`) and in the browser (building links).
 *
 * Every field reads a string, because that is what an address holds. Two parameters have one-letter
 * names in the address (`r` and `q`, kept from Phase 1); in code they are `radiusKm` and `keyword`,
 * because names are words (R-GEN-11), and ADDRESS_NAMES maps them at the edge. A value that does not fit is
 * dropped, never thrown on: see `parseSearchParams`. `bbox` (the map viewport) belongs to the map
 * view (S4b) and is not part of this contract yet.
 */

/** The page the search address points to. */
export const SEARCH_PATH = "/properties";

export const LISTING_TYPES = ["sale", "rent"] as const;
export const LABEL_FILTERS = ["featured", "prime", "budget"] as const;
export const VIEWS = ["grid", "list"] as const;

/** What an omitted value means. Defaults are left out of the address (frontend.md 6.1 rule 2). */
export const DEFAULT_SORT = "newest" as const;
export const DEFAULT_SHOW = 12;
export const DEFAULT_VIEW = "grid" as const;
export const DEFAULT_RADIUS_KM = 5;

/** "Show more" adds 12 at a time up to 120 (DEC-11). */
export const SHOW_STEP = 12;
export const SHOW_MAX = 120;
export const RADIUS_MIN_KM = 1;
export const RADIUS_MAX_KM = 50;

const text = (max: number) => z.string().trim().min(1).max(max);

/** A whole number written in digits only: no sign, no decimals, no exponent. */
const digits = (maxLength: number) => z.string().regex(new RegExp(`^\\d{1,${maxLength}}$`));

const coordinate = (limit: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d{1,8})?$/)
    .transform(Number)
    .pipe(z.number().min(-limit).max(limit));

/** One schema per parameter. A parameter that fails its schema is dropped from the search. */
export const SEARCH_FIELD_SCHEMAS = {
  listingType: z.enum(LISTING_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  bhk: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number),
  minPrice: digits(12).transform(Number),
  maxPrice: digits(12).transform(Number),
  place: text(80),
  lat: coordinate(90),
  lng: coordinate(180),
  radiusKm: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/)
    .transform(Number)
    .pipe(z.number().min(RADIUS_MIN_KM).max(RADIUS_MAX_KM)),
  locality: text(80),
  keyword: text(120),
  label: z.enum(LABEL_FILTERS),
  sort: z.enum(SORT_OPTIONS),
  show: digits(3)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(DEFAULT_SHOW)
        .max(SHOW_MAX)
        .refine((value) => value % SHOW_STEP === 0),
    ),
  view: z.enum(VIEWS),
} as const;

export type SearchField = keyof typeof SEARCH_FIELD_SCHEMAS;

/** The two fields whose name in the address is not their name in code. */
export const ADDRESS_NAMES = { radiusKm: "r", keyword: "q" } as const;

/** The name a field has in the address. */
export function addressName(field: SearchField): string {
  return field === "radiusKm" || field === "keyword" ? ADDRESS_NAMES[field] : field;
}

/** The fields in the order they are written to an address: alphabetical by address name, so one search has one address. */
export const SEARCH_FIELDS = (Object.keys(SEARCH_FIELD_SCHEMAS) as SearchField[]).sort(
  (first, second) => (addressName(first) < addressName(second) ? -1 : 1),
);

/** What a search holds once parsed: the optional filters as given, and the three settings with their defaults. */
export type SearchParams = {
  listingType?: z.infer<(typeof SEARCH_FIELD_SCHEMAS)["listingType"]>;
  propertyType?: z.infer<(typeof SEARCH_FIELD_SCHEMAS)["propertyType"]>;
  /** One value, 1 to 4 (not a range). */
  bhk?: number;
  /** Whole rupees. */
  minPrice?: number;
  maxPrice?: number;
  /** The label of the picked place, for display only. */
  place?: string;
  /** Both or neither. */
  lat?: number;
  lng?: number;
  /** Kilometres around lat and lng; the default is DEFAULT_RADIUS_KM when it is left out. */
  radiusKm?: number;
  /** Text match on the locality, the fallback when no place was picked. */
  locality?: string;
  /** Keyword. */
  keyword?: string;
  label?: z.infer<(typeof SEARCH_FIELD_SCHEMAS)["label"]>;
  sort: z.infer<(typeof SEARCH_FIELD_SCHEMAS)["sort"]>;
  show: number;
  view: z.infer<(typeof SEARCH_FIELD_SCHEMAS)["view"]>;
};

/** The parameters that narrow the results. "Clear all" removes these and keeps sort and view. */
export const FILTER_FIELDS = [
  "listingType",
  "propertyType",
  "bhk",
  "minPrice",
  "maxPrice",
  "place",
  "lat",
  "lng",
  "radiusKm",
  "locality",
  "keyword",
  "label",
] as const satisfies readonly SearchField[];
