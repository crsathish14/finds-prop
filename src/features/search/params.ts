import {
  DEFAULT_RADIUS_KM,
  addressName,
  DEFAULT_SHOW,
  DEFAULT_SORT,
  DEFAULT_VIEW,
  SEARCH_FIELDS,
  SEARCH_FIELD_SCHEMAS,
  SEARCH_PATH,
  type SearchField,
  type SearchParams,
} from "./schemas";

/** What the server gets as `searchParams` (an object) or the browser has in `location.search`. */
export type RawSearchParams =
  URLSearchParams | Record<string, string | readonly string[] | undefined>;

/** The area places must lie in (the region's bounds in the site settings), when the caller has it. */
export type SearchBounds = { south: number; west: number; north: number; east: number };

function readRaw(raw: RawSearchParams, field: SearchField): string | undefined {
  const name = addressName(field);
  if (raw instanceof URLSearchParams) return raw.get(name) ?? undefined;
  const value = raw[name];
  const first = typeof value === "string" ? value : value?.[0];
  return typeof first === "string" ? first : undefined;
}

function insideBounds(lat: number, lng: number, bounds: SearchBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

/**
 * Reads a search from an address (frontend.md 6.1). A parameter that does not fit its rule is
 * dropped, never thrown on, so a hand-edited or old link still opens a search. When a parameter
 * is repeated, the first one counts. The place needs both lat and lng (and to lie inside the
 * bounds, when they are given); without a place the radius means nothing and is dropped too.
 * Sort, show and view always have a value: their defaults when left out.
 */
export function parseSearchParams(
  raw: RawSearchParams,
  options: { bounds?: SearchBounds } = {},
): SearchParams {
  const found: Record<string, unknown> = {};
  for (const field of SEARCH_FIELDS) {
    const value = readRaw(raw, field);
    if (value === undefined) continue;
    const result = SEARCH_FIELD_SCHEMAS[field].safeParse(value);
    if (result.success) found[field] = result.data;
  }

  const lat = found["lat"];
  const lng = found["lng"];
  const placed =
    typeof lat === "number" &&
    typeof lng === "number" &&
    (options.bounds === undefined || insideBounds(lat, lng, options.bounds));
  if (!placed) {
    delete found["lat"];
    delete found["lng"];
    delete found["radiusKm"];
  }

  // Each value above passed the schema of its own parameter, which is what SearchParams says.
  return { sort: DEFAULT_SORT, show: DEFAULT_SHOW, view: DEFAULT_VIEW, ...found } as SearchParams;
}

function isDefault(field: SearchField, value: unknown): boolean {
  switch (field) {
    case "sort":
      return value === DEFAULT_SORT;
    case "show":
      return value === DEFAULT_SHOW;
    case "view":
      return value === DEFAULT_VIEW;
    case "radiusKm":
      return value === DEFAULT_RADIUS_KM;
    default:
      return false;
  }
}

function format(field: SearchField, value: unknown): string {
  // Coordinates keep six decimals (about 10 cm); more only makes the address longer.
  if ((field === "lat" || field === "lng") && typeof value === "number") {
    return String(Number(value.toFixed(6)));
  }
  return String(value);
}

/**
 * The address of a search: `/properties` and the parameters that are not their default, in
 * alphabetical order, so one search has one address. The values go through the same rules as
 * `parseSearchParams`, so a value that does not fit is left out rather than written.
 */
export function buildSearchHref(params: Partial<SearchParams> = {}): string {
  const raw: Record<string, string> = {};
  for (const field of SEARCH_FIELDS) {
    const value = params[field];
    if (value !== undefined) raw[addressName(field)] = format(field, value);
  }
  const parsed = parseSearchParams(raw);
  const query = new URLSearchParams();
  for (const field of SEARCH_FIELDS) {
    const value = parsed[field];
    if (value === undefined || isDefault(field, value)) continue;
    query.set(addressName(field), format(field, value));
  }
  const text = query.toString();
  return text === "" ? SEARCH_PATH : `${SEARCH_PATH}?${text}`;
}

/**
 * The canonical address of a search (FR-PUB-14): its filters, written as `buildSearchHref` writes
 * them, without the sort, the number shown and the view. Those change how the same homes are laid out,
 * not which homes they are, so `?view=list` and `?sort=price-asc` share the filtered page's address.
 */
export function canonicalSearchHref(params: SearchParams): string {
  const filters: Partial<SearchParams> = { ...params };
  delete filters.sort;
  delete filters.show;
  delete filters.view;
  return buildSearchHref(filters);
}

/** "Clear all": every filter goes, sort and view stay (frontend.md 6.1 rule 3); "show more" starts again. */
export function clearSearchFilters(params: SearchParams): SearchParams {
  return parseSearchParams({ sort: params.sort, view: params.view });
}

/** The radius to search with: the one in the address, or the default. */
export function searchRadiusKm(params: SearchParams): number {
  return params.radiusKm ?? DEFAULT_RADIUS_KM;
}
