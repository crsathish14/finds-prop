/**
 * The choices the search card and the filters offer (S4-T01). One list for each, so the search card,
 * the filter rail and the filter sheet cannot disagree. The values are what the search function
 * accepts (`search_properties`: p_listing_type, p_property_type, p_bhk, p_max_price); the words are
 * in en.json under `domain.searchCard`.
 *
 * The budget steps are the ones drawn in the approved UX (interaction-specifications section 1,
 * "exact steps to confirm"); the owner confirmed them on 4 Nov 2026.
 */

/** Buy and Rent change which budget steps are offered. */
export const SEARCH_INTENTS = ["buy", "rent"] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];

/** The kinds of property, named as the database names them. */
export const PROPERTY_TYPES = ["apartment", "villa", "house", "plot", "commercial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** The words for each kind, as literal keys so the messages check can see they are used. */
export const PROPERTY_TYPE_WORDS = {
  apartment: "domain.searchCard.propertyType.apartment",
  villa: "domain.searchCard.propertyType.villa",
  house: "domain.searchCard.propertyType.house",
  plot: "domain.searchCard.propertyType.plot",
  commercial: "domain.searchCard.propertyType.commercial",
} as const satisfies Record<PropertyType, string>;

/** Bedrooms are one value, 1 to 4, or Any (null): the filter is not a range. */
export const BEDROOM_CHOICES = [1, 2, 3, 4] as const;
export type BedroomChoice = (typeof BEDROOM_CHOICES)[number];

/** Maximum budget only, in whole rupees: sale amounts to buy, monthly rent to rent. */
export const BUDGET_STEPS = {
  buy: [50_00_000, 75_00_000, 1_00_00_000, 1_50_00_000, 2_00_00_000, 3_00_00_000],
  rent: [15_000, 25_000, 40_000, 60_000, 1_00_000],
} as const satisfies Record<SearchIntent, readonly number[]>;

export function budgetStepsFor(intent: SearchIntent): readonly number[] {
  return BUDGET_STEPS[intent];
}

/**
 * The budget to keep when Buy and Rent are switched: the same amount if the new list has it,
 * otherwise Any (null), because a sale amount is not a rent amount.
 */
export function keepBudget(intent: SearchIntent, rupees: number | null): number | null {
  return rupees !== null && budgetStepsFor(intent).includes(rupees) ? rupees : null;
}

/** Reads the text a select gives back; anything that is not one of the choices means Any. */
export function parsePropertyType(text: string): PropertyType | null {
  return PROPERTY_TYPES.find((type) => type === text) ?? null;
}

export function parseBedrooms(text: string): BedroomChoice | null {
  return BEDROOM_CHOICES.find((count) => String(count) === text) ?? null;
}

export function parseBudget(intent: SearchIntent, text: string): number | null {
  return budgetStepsFor(intent).find((rupees) => String(rupees) === text) ?? null;
}
