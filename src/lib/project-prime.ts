/**
 * Prime projects (ADR-208): the super admin sets one amount for each kind of project price, and a project is Prime when
 * its price is at or above the amount for its price type. The tag is worked out from the current amounts every time a
 * project is read, so a change to an amount applies to every project at once. Prime is a fact about a project and a
 * filter in the AI search; it never changes the order of results (it is not a promotion tier, ADR-205).
 *
 * Pure: no server code, so the site, the AI tools and the admin page share this one rule.
 */

/** The four amounts, in whole rupees. Null means no project priced that way is Prime. */
export interface ProjectPrimeRules {
  /** A rate per sq ft for sale. */
  readonly ratePerSqft: number | null;
  /** A total price: a basic price or an all inclusive price. */
  readonly totalPrice: number | null;
  /** A rent per month. */
  readonly rentPerMonth: number | null;
  /** A rent per sq ft per month. */
  readonly rentPerSqftMonth: number | null;
}

export type ProjectPrimeRule = keyof ProjectPrimeRules;

/** The amounts in the order the admin page shows them. */
export const PROJECT_PRIME_RULES = [
  "ratePerSqft",
  "totalPrice",
  "rentPerMonth",
  "rentPerSqftMonth",
] as const satisfies readonly ProjectPrimeRule[];

/** Which amount each project price type is held to (`projects.price_type`). */
export const PRIME_RULE_OF_PRICE_TYPE = {
  per_sqft: "ratePerSqft",
  basic: "totalPrice",
  all_inclusive: "totalPrice",
  rent_per_month: "rentPerMonth",
  rent_per_sqft_month: "rentPerSqftMonth",
} as const satisfies Record<string, ProjectPrimeRule>;

export type PrimePriceType = keyof typeof PRIME_RULE_OF_PRICE_TYPE;

/** The largest amount the admin may type: twelve digits, as the searches read a price. */
export const PROJECT_PRIME_AMOUNT_MAX = 999_999_999_999;

/**
 * The amounts before the super admin saves any (owner decision 26 Nov 2026): the same as a Prime home, ₹1.5 crore for a
 * total price and ₹60,000 for a rent per month; the two per sq ft amounts are empty until the admin sets them.
 */
export const PROJECT_PRIME_DEFAULTS: ProjectPrimeRules = {
  ratePerSqft: null,
  totalPrice: 15_000_000,
  rentPerMonth: 60_000,
  rentPerSqftMonth: null,
};

/** What the rule reads about a project: its one price and what that price means. */
export interface PrimeCandidate {
  readonly price: number | null;
  readonly priceType: string | null;
}

function isPrimePriceType(priceType: string): priceType is PrimePriceType {
  return Object.hasOwn(PRIME_RULE_OF_PRICE_TYPE, priceType);
}

/**
 * Whether a project is Prime under these amounts. A project with no price, no price type or a price type with no
 * amount set is never Prime.
 */
export function isPrimeProject(rules: ProjectPrimeRules, project: PrimeCandidate): boolean {
  if (project.price === null || project.priceType === null) return false;
  if (!isPrimePriceType(project.priceType)) return false;
  const amount = rules[PRIME_RULE_OF_PRICE_TYPE[project.priceType]];
  return amount !== null && project.price >= amount;
}
