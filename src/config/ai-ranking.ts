/**
 * The numbers of the AI search ranking (ADR-205), in one file: what counts as a good match, how much each part of the
 * fit weighs, the order of the promotion tiers, and the slightly-above-budget slot. Nothing in the ranking code or the
 * prompt repeats them. Changing one changes the order of results, so the ranking tests read them from here too.
 *
 * How a result is ordered (`src/features/ai-chat/ranking/rank.ts`): every candidate already meets every filter the
 * customer gave (the search applies them). Each gets a relevance from 0 to 100 from the parts below. Candidates at or
 * above `AI_RANKING_STRONG_MATCH` come first; inside each of the two bands the promotion tier decides, then relevance,
 * then the newest. So a promotion orders genuine matches and never lifts a weak match above a strong one.
 */

/** The most candidates one search ranks: the most `search_properties()` and `live_project_list()` give in one read. */
export const AI_RANKING_CANDIDATE_LIMIT = 120;

/** A candidate with at least this relevance (0 to 100) is a strong match. */
export const AI_RANKING_STRONG_MATCH = 60;

/**
 * How much each part of the fit weighs. A part the customer said nothing about (no budget, no preference, no place)
 * scores full marks for everyone, so it changes no order.
 */
export const AI_RANKING_WEIGHTS = {
  /** The customer's preferences that the candidate meets: preferred localities, amenities, furnishing. */
  preferences: 40,
  /** How well the price uses the budget: well under it scores a little lower than close to it, never over it. */
  budget: 20,
  /** How close to the place asked for (place search only). */
  distance: 15,
  /** How recently it was listed. */
  freshness: 10,
  /** How complete the listing is (area, photos, price). */
  completeness: 15,
} as const;

/** A price at or above this share of the maximum budget gets full budget marks. */
export const AI_RANKING_BUDGET_FULL_SHARE = 0.75;

/** Listed within this many days: full freshness marks; marks then fall to the floor at `AI_RANKING_FRESH_FLOOR_DAYS`. */
export const AI_RANKING_FRESH_DAYS = 30;
export const AI_RANKING_FRESH_FLOOR_DAYS = 365;
/** The freshness marks of a listing at or past `AI_RANKING_FRESH_FLOOR_DAYS` old, as a share of full marks. */
export const AI_RANKING_FRESH_FLOOR = 0.3;

/**
 * The promotion tiers, best first (owner, 26 Nov 2026). A builder or project in several categories gets its best tier
 * once; tiers never add up. `none` is every other match. The Prime tag is not a tier: it never changes the order.
 */
export const AI_PROMOTION_TIERS = ["sponsored", "featured", "spotlight", "top", "none"] as const;
export type AiPromotionTier = (typeof AI_PROMOTION_TIERS)[number];

/**
 * The slightly-above-budget slot (owner, 26 Nov 2026, decision D4): at most one promoted project or home that misses
 * only the maximum budget, by at most this share, shown apart from the matches.
 */
export const AI_NEAR_MISS_OVER_BUDGET_SHARE = 0.1;

/**
 * Amenity words customers and listings write differently, each group meaning one thing. Words are compared in lower
 * case, word by word; a wanted amenity also matches a listed one that holds all its words ("security" matches "24x7
 * security", but "park" never matches "parking"), so only true synonyms belong here.
 */
export const AI_AMENITY_SYNONYMS: readonly (readonly string[])[] = [
  ["parking", "car park", "carpark", "car parking"],
  ["swimming pool", "pool"],
  ["play area", "children's play area", "children's park", "kids play area"],
  ["lift", "lifts", "elevator"],
  ["gym", "gymnasium", "fitness centre", "fitness center"],
  ["garden", "landscaped garden"],
  ["security guard", "security", "watchman"],
  ["power backup", "generator", "power back up"],
  ["gated community", "gated"],
];
