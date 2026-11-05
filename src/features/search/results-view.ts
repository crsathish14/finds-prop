import {
  BEDROOM_CHOICES,
  PROPERTY_TYPE_WORDS,
  type BedroomChoice,
  type FilterValues,
} from "@/config/search-options";
import { formatPrice, type Translate } from "@/lib/format";
import { listingTypeFor, placeParams, type CuratedLocality } from "./from-card";
import { buildSearchHref } from "./params";
import {
  addressName,
  FILTER_FIELDS,
  SEARCH_FIELDS,
  SEARCH_PATH,
  SHOW_MAX,
  SHOW_STEP,
  type SearchParams,
} from "./schemas";

/**
 * The rules the results page applies between the address and the screen (S4-T04, ADR-042). Pure:
 * no framework, no state, so the same rules are tested without a browser.
 */

/** The fields a search takes with it when a filter changes: how it is sorted, shown and labelled. */
type SearchPatch = Partial<SearchParams>;

/** What the filter rail and sheet hold, read from the address. */
export function filterValuesFromParams(params: SearchParams): FilterValues {
  const bedrooms = (BEDROOM_CHOICES as readonly number[]).includes(params.bhk ?? 0)
    ? (params.bhk as BedroomChoice)
    : null;
  return {
    intent: params.listingType === "sale" ? "buy" : params.listingType === "rent" ? "rent" : "all",
    locality: params.place ?? params.locality ?? null,
    propertyType: params.propertyType ?? null,
    bedrooms,
    maxBudget: params.maxPrice ?? null,
    sort: params.sort,
  };
}

/**
 * The search the filter values mean. A locality that is one of the curated places becomes that place
 * (its point and radius); any other text is a text match. The budget is dropped while Looking to is
 * All (a sale cap does not cap rents). What the filters do not hold (the keyword, the label and the
 * view) is kept, and "show" starts again, because a changed search starts from its first page.
 */
export function searchFromFilterValues(
  params: SearchParams,
  values: FilterValues,
  curated: readonly CuratedLocality[],
): SearchPatch {
  const next: SearchPatch = { sort: values.sort, view: params.view };
  if (params.keyword !== undefined) next.keyword = params.keyword;
  if (params.label !== undefined) next.label = params.label;
  if (params.minPrice !== undefined) next.minPrice = params.minPrice;
  const listingType = listingTypeFor(values.intent);
  if (listingType !== undefined) next.listingType = listingType;
  if (values.locality !== null) {
    const picked = curated.find(
      (place) => place.label.toLowerCase() === (values.locality ?? "").toLowerCase(),
    );
    if (picked) Object.assign(next, placeParams(picked));
    else next.locality = values.locality;
  }
  if (values.propertyType !== null) next.propertyType = values.propertyType;
  if (values.bedrooms !== null) next.bhk = values.bedrooms;
  if (values.maxBudget !== null && values.intent !== "all") next.maxPrice = values.maxBudget;
  return next;
}

/** The same search with some fields replaced; "show" starts again unless the patch sets it. */
export function changeSearch(params: SearchParams, patch: SearchPatch): SearchPatch {
  const next: SearchPatch = { ...params, ...patch };
  if (patch.show === undefined) delete next.show;
  return next;
}

/** The search with the quick label set, or taken off when the choice is All. */
export function withLabel(
  params: SearchParams,
  label: "all" | NonNullable<SearchParams["label"]>,
): SearchPatch {
  const next = changeSearch(params, {});
  if (label === "all") delete next.label;
  else next.label = label;
  return next;
}

/** One applied filter, as a chip: an id to take it off by, and the words. */
export type AppliedFilter = {
  id: "place" | "propertyType" | "bhk" | "maxPrice" | "keyword";
  label: string;
};

/** The applied filters in the UX order: place, kind of property, bedrooms, budget, then the keyword. */
export function appliedFilters(
  params: SearchParams,
  translate: Translate,
  locale: string,
): AppliedFilter[] {
  const chips: AppliedFilter[] = [];
  const place = params.place ?? params.locality;
  if (place !== undefined) chips.push({ id: "place", label: place });
  if (params.propertyType !== undefined) {
    chips.push({ id: "propertyType", label: translate(PROPERTY_TYPE_WORDS[params.propertyType]) });
  }
  if (params.bhk !== undefined) {
    chips.push({ id: "bhk", label: translate("property.bhk", { count: params.bhk }) });
  }
  if (params.maxPrice !== undefined) {
    chips.push({
      id: "maxPrice",
      label: translate("domain.searchCard.budget.upTo", {
        amount: formatPrice(translate, locale, params.maxPrice),
      }),
    });
  }
  if (params.keyword !== undefined) {
    chips.push({ id: "keyword", label: translate("results.keyword", { keyword: params.keyword }) });
  }
  return chips;
}

/** The search without one filter. Taking the place off takes its point and radius too. */
export function withoutFilter(params: SearchParams, id: string): SearchPatch {
  const next: SearchPatch = { ...params };
  delete next.show;
  switch (id) {
    case "place":
      delete next.place;
      delete next.locality;
      delete next.lat;
      delete next.lng;
      delete next.radiusKm;
      break;
    case "propertyType":
      delete next.propertyType;
      break;
    case "bhk":
      delete next.bhk;
      break;
    case "maxPrice":
      delete next.maxPrice;
      break;
    case "keyword":
      delete next.keyword;
      break;
  }
  return next;
}

/** True when the search holds any filter at all (Clear all and the empty state depend on it). */
export function hasFilters(params: SearchParams): boolean {
  return FILTER_FIELDS.some((field) => params[field] !== undefined);
}

/** What "Show more" asks for: 12 more homes, never above the cap. */
export function nextShow(show: number): number {
  return Math.min(SHOW_MAX, show + SHOW_STEP);
}

/** True when "Show more" has reached the cap and the button becomes "Refine your search". */
export function atShowLimit(show: number): boolean {
  return show >= SHOW_MAX;
}

/** The words for each kind of property in the heading, as literal keys so the messages check sees them. */
const KIND_WORDS = {
  any: "results.kind.any",
  apartment: "results.kind.apartment",
  villa: "results.kind.villa",
  house: "results.kind.house",
  plot: "results.kind.plot",
  commercial: "results.kind.commercial",
} as const;

/** The heading for each Looking to, one whole message each so no message is only variables. */
const TITLE_WORDS = {
  any: "results.title.any",
  sale: "results.title.sale",
  rent: "results.title.rent",
} as const;

/**
 * The heading of the page: "Apartments for sale in Velachery". The place is the part set in copper;
 * without one the heading has no emphasis. With nothing chosen it reads "Homes for sale and rent".
 */
export function resultsHeading(
  params: SearchParams,
  translate: Translate,
): { title: string; emphasis?: string } {
  const base = translate(TITLE_WORDS[params.listingType ?? "any"], {
    kind: translate(KIND_WORDS[params.propertyType ?? "any"]),
  });
  const place = params.place ?? params.locality;
  if (place === undefined) return { title: base };
  return { title: translate("results.title.inPlace", { base, place }), emphasis: place };
}

/** The place the results are about, for the count line and the breadcrumb. */
export function resultsPlace(params: SearchParams): string | undefined {
  return params.place ?? params.locality;
}

/**
 * Where the visitor should be if the address is not the canonical one: alphabetical, defaults left
 * out, invalid values gone (frontend.md 6.1 rule 1 and 2). Only the parameters of the contract are
 * compared, so an address with extras (a campaign tag, say) is left alone. Returns the canonical
 * address, or null when the address already is it.
 */
export function canonicalRedirect(
  raw: Record<string, string | readonly string[] | undefined>,
  params: SearchParams,
): string | null {
  const known = new Set(SEARCH_FIELDS.map((field) => addressName(field)));
  // In the order the address has them, so an address with its parameters in another order is sent to
  // the alphabetical one (rule 2): one search, one address.
  const given = new URLSearchParams();
  for (const [name, value] of Object.entries(raw)) {
    if (!known.has(name)) continue;
    const first = typeof value === "string" ? value : value?.[0];
    if (typeof first === "string") given.set(name, first);
  }
  const canonical = buildSearchHref(params);
  const givenText = given.toString();
  const href = givenText === "" ? SEARCH_PATH : `${SEARCH_PATH}?${givenText}`;
  return href === canonical ? null : canonical;
}
