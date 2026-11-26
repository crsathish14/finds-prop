import "server-only";
import { buildSearchHref, type SearchParams } from "@/features/search";
import type { Translate } from "@/lib/format";
import { searchPropertiesInputSchema } from "../tools/search-properties";
import type { RememberedSearch } from "./chat-state";

/**
 * The "See all" link under a home search's answer (ADR-206): the results page with the same filters, built here from
 * the filters the search ran with, never by the model. Preferences only rank, so they are left out (the page has none).
 * The results page's address has no city (the header picker chooses it), so a city goes into the keyword, which reads
 * the title, the locality and the city; the count may then differ a little, so that link names no number.
 */

/** The `en.json` keys of the link's words, written out so the message check finds them. */
export const SEE_ALL_MESSAGE_KEYS = {
  counted: "ai.seeAll.counted",
  plain: "ai.seeAll.plain",
} as const;

/** Every filter of the home search as not asked for: a remembered filter the search did not have stays not asked. */
const NOT_ASKED = {
  listingType: null,
  propertyType: null,
  bhk: null,
  minPrice: null,
  maxPrice: null,
  city: null,
  locality: null,
  keyword: null,
  label: null,
  preferLocalities: null,
  preferAmenities: null,
  preferFurnishing: null,
  sort: null,
};

/** The longest keyword the results page reads. */
const KEYWORD_MAX_CHARACTERS = 120;

function given(text: string | null): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export interface SeeAllLink {
  readonly text: string;
  readonly href: string;
}

/**
 * The link for this search, or null: only for a home search that was not around a place (the results page would need
 * the place's position) and that has more matches than the chat has shown.
 */
export function seeAllLink(search: RememberedSearch, translate: Translate): SeeAllLink | null {
  if (search.tool !== "search_properties" || search.place) return null;
  if (search.total <= search.shown.length) return null;
  const parsed = searchPropertiesInputSchema.safeParse({
    ...NOT_ASKED,
    ...search.filters,
    page: null,
  });
  if (!parsed.success) return null;
  const filters = parsed.data;
  const city = given(filters.city);
  const keyword = given(filters.keyword);
  const locality = given(filters.locality);
  const withCity = [keyword, city].filter((part) => part !== null).join(" ");
  const searchWords =
    withCity !== "" && withCity.length <= KEYWORD_MAX_CHARACTERS ? withCity : keyword;
  const params: Partial<SearchParams> = {
    ...(filters.listingType === null ? {} : { listingType: filters.listingType }),
    ...(filters.propertyType === null ? {} : { propertyType: filters.propertyType }),
    ...(filters.bhk === null ? {} : { bhk: filters.bhk }),
    ...(filters.minPrice === null ? {} : { minPrice: filters.minPrice }),
    ...(filters.maxPrice === null ? {} : { maxPrice: filters.maxPrice }),
    ...(locality === null ? {} : { locality }),
    ...(searchWords === null ? {} : { keyword: searchWords }),
    ...(filters.label === null ? {} : { label: filters.label }),
    ...(filters.sort === null ? {} : { sort: filters.sort }),
  };
  return {
    href: buildSearchHref(params),
    text:
      city === null
        ? translate(SEE_ALL_MESSAGE_KEYS.counted, { total: search.total })
        : translate(SEE_ALL_MESSAGE_KEYS.plain),
  };
}
