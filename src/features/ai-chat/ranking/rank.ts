/**
 * The AI search ranking (ADR-205): pure functions, no reads, so every rule is tested on its own. The search has
 * already applied every filter the customer gave, so every candidate here is a genuine match; this only decides the
 * order, says which preferences each one meets, and which facts hold across all the matches (the lowest price, the
 * largest area). The numbers live in `src/config/ai-ranking.ts`.
 *
 * The order: strong matches first (relevance at or above `AI_RANKING_STRONG_MATCH`), then the rest. Inside each band,
 * the promotion tier (best first), then relevance, then the newest, then the id, so the same search always gives the
 * same order. A promotion never lifts a weak match above a strong one, and tiers never add up.
 */
import {
  AI_AMENITY_SYNONYMS,
  AI_NEAR_MISS_OVER_BUDGET_SHARE,
  AI_PROMOTION_TIERS,
  AI_RANKING_BUDGET_FULL_SHARE,
  AI_RANKING_FRESH_DAYS,
  AI_RANKING_FRESH_FLOOR,
  AI_RANKING_FRESH_FLOOR_DAYS,
  AI_RANKING_STRONG_MATCH,
  AI_RANKING_WEIGHTS,
  type AiPromotionTier,
} from "@/config/ai-ranking";
import { localityKey } from "../localities";

/** What the ranking needs to know about one candidate, whatever it is (a home or a project). */
export interface RankFeatures {
  /** A stable id, the last tie-break. */
  readonly id: string;
  /** A price that compares with the customer's budget (a total, or a monthly rent), or null when there is none. */
  readonly price: number | null;
  readonly areaSqft: number | null;
  /** Days since it was listed, or null when not known. */
  readonly ageDays: number | null;
  /** Kilometres from the place searched, or null without a place. */
  readonly distanceKm: number | null;
  readonly tier: AiPromotionTier;
  /** Its locality as listed, or null. */
  readonly locality: string | null;
  /** The amenities it lists, or null when they were not read (then amenity preferences are not counted for it). */
  readonly amenities: readonly string[] | null;
  /** Its furnishing (`full`, `semi`, `unfurnished`), or null when not given or not read. */
  readonly furnishing: string | null;
  /** How complete the listing is, from 0 to 1 (area, photos, price), worked out by the caller. */
  readonly completeness: number;
}

/** What the customer would like but did not make a filter of, and the limits the fit is measured against. */
export interface RankWants {
  readonly maxPrice: number | null;
  readonly radiusKm: number | null;
  readonly preferLocalities: readonly string[];
  readonly preferAmenities: readonly string[];
  readonly preferFurnishing: string | null;
}

/** One preference, met or missed: what kind it is and the words the customer gave. */
export interface PreferenceOutcome {
  readonly kind: "locality" | "amenity" | "furnishing";
  readonly value: string;
}

export interface RankedEntry<Item> {
  readonly item: Item;
  /** From 0 to 100, one decimal. */
  readonly relevance: number;
  readonly strong: boolean;
  readonly tier: AiPromotionTier;
  readonly met: readonly PreferenceOutcome[];
  readonly missed: readonly PreferenceOutcome[];
  /** It has the lowest price of all the candidates ranked (several may share it). */
  readonly lowestPrice: boolean;
  /** It has the largest area of all the candidates ranked (several may share it). */
  readonly largestArea: boolean;
}

/** The words of an amenity, lower case, letters and digits only. */
function words(text: string): string[] {
  return localityKey(text.replace(/'s\b/gu, "s"))
    .split(" ")
    .filter((word) => word !== "");
}

/** Every way of writing the amenity the customer asked for: its synonym group, or just itself. */
function variantsOf(wanted: string): string[][] {
  const phrase = words(wanted).join(" ");
  const group = AI_AMENITY_SYNONYMS.find((members) =>
    members.some((member) => words(member).join(" ") === phrase),
  );
  return (group ?? [wanted]).map(words).filter((variant) => variant.length > 0);
}

/** Whether a listed amenity holds every word of one way of writing the wanted one. */
export function hasAmenity(listed: readonly string[], wanted: string): boolean {
  const variants = variantsOf(wanted);
  return listed.some((amenity) => {
    const have = new Set(words(amenity));
    return variants.some((variant) => variant.every((word) => have.has(word)));
  });
}

/** Whether a locality is one of the preferred ones (either holds the other, spelling-proof). */
export function inPreferredLocality(locality: string | null, preferred: string): boolean {
  if (locality === null) return false;
  const have = localityKey(locality);
  const want = localityKey(preferred);
  return want !== "" && (have.includes(want) || (have !== "" && want.includes(have)));
}

function preferenceScore(features: RankFeatures, wants: RankWants) {
  const met: PreferenceOutcome[] = [];
  const missed: PreferenceOutcome[] = [];
  if (wants.preferLocalities.length > 0) {
    const hit = wants.preferLocalities.find((place) =>
      inPreferredLocality(features.locality, place),
    );
    if (hit === undefined)
      missed.push({ kind: "locality", value: wants.preferLocalities.join(", ") });
    else met.push({ kind: "locality", value: hit });
  }
  if (features.amenities !== null) {
    for (const amenity of wants.preferAmenities) {
      (hasAmenity(features.amenities, amenity) ? met : missed).push({
        kind: "amenity",
        value: amenity,
      });
    }
  }
  if (wants.preferFurnishing !== null && features.furnishing !== null) {
    (features.furnishing === wants.preferFurnishing ? met : missed).push({
      kind: "furnishing",
      value: wants.preferFurnishing,
    });
  }
  const counted = met.length + missed.length;
  return { score: counted === 0 ? 1 : met.length / counted, met, missed };
}

function budgetScore(price: number | null, maxPrice: number | null): number {
  if (price === null || maxPrice === null || maxPrice <= 0) return 1;
  const share = Math.min(price / maxPrice, 1);
  if (share >= AI_RANKING_BUDGET_FULL_SHARE) return 1;
  return 0.5 + 0.5 * (share / AI_RANKING_BUDGET_FULL_SHARE);
}

function distanceScore(distanceKm: number | null, radiusKm: number | null): number {
  if (distanceKm === null || radiusKm === null || radiusKm <= 0) return 1;
  return 1 - 0.7 * Math.min(distanceKm / radiusKm, 1);
}

function freshnessScore(ageDays: number | null): number {
  if (ageDays === null) return 0.5;
  if (ageDays <= AI_RANKING_FRESH_DAYS) return 1;
  if (ageDays >= AI_RANKING_FRESH_FLOOR_DAYS) return AI_RANKING_FRESH_FLOOR;
  const span = AI_RANKING_FRESH_FLOOR_DAYS - AI_RANKING_FRESH_DAYS;
  return 1 - (1 - AI_RANKING_FRESH_FLOOR) * ((ageDays - AI_RANKING_FRESH_DAYS) / span);
}

/** The relevance of one candidate, from 0 to 100, and the preferences it meets and misses. */
export function relevanceOf(features: RankFeatures, wants: RankWants) {
  const preferences = preferenceScore(features, wants);
  const parts: Record<keyof typeof AI_RANKING_WEIGHTS, number> = {
    preferences: preferences.score,
    budget: budgetScore(features.price, wants.maxPrice),
    distance: distanceScore(features.distanceKm, wants.radiusKm),
    freshness: freshnessScore(features.ageDays),
    completeness: Math.min(Math.max(features.completeness, 0), 1),
  };
  let total = 0;
  let weights = 0;
  for (const [part, weight] of Object.entries(AI_RANKING_WEIGHTS)) {
    total += weight * parts[part as keyof typeof AI_RANKING_WEIGHTS];
    weights += weight;
  }
  const relevance = Math.round((total / weights) * 1000) / 10;
  return { relevance, met: preferences.met, missed: preferences.missed };
}

const tierIndex = (tier: AiPromotionTier) => AI_PROMOTION_TIERS.indexOf(tier);

/** The candidates in ranking order, each with its relevance, its tier and the preferences it meets and misses. */
export function rankCandidates<Item>(
  items: readonly Item[],
  featuresOf: (item: Item) => RankFeatures,
  wants: RankWants,
): RankedEntry<Item>[] {
  const scored = items.map((item) => {
    const features = featuresOf(item);
    const { relevance, met, missed } = relevanceOf(features, wants);
    return { item, features, relevance, met, missed, strong: relevance >= AI_RANKING_STRONG_MATCH };
  });
  const prices = scored.flatMap(({ features }) =>
    features.price === null ? [] : [features.price],
  );
  const areas = scored.flatMap(({ features }) =>
    features.areaSqft === null ? [] : [features.areaSqft],
  );
  const lowest = prices.length > 0 ? Math.min(...prices) : null;
  const largest = areas.length > 0 ? Math.max(...areas) : null;

  scored.sort((first, second) => {
    if (first.strong !== second.strong) return first.strong ? -1 : 1;
    const tiers = tierIndex(first.features.tier) - tierIndex(second.features.tier);
    if (tiers !== 0) return tiers;
    if (first.relevance !== second.relevance) return second.relevance - first.relevance;
    const firstAge = first.features.ageDays ?? Number.POSITIVE_INFINITY;
    const secondAge = second.features.ageDays ?? Number.POSITIVE_INFINITY;
    if (firstAge !== secondAge) return firstAge - secondAge;
    if (first.features.id === second.features.id) return 0;
    return first.features.id < second.features.id ? -1 : 1;
  });

  return scored.map(({ item, features, relevance, met, missed, strong }) => ({
    item,
    relevance,
    strong,
    tier: features.tier,
    met,
    missed,
    lowestPrice: lowest !== null && features.price === lowest,
    largestArea: largest !== null && features.areaSqft === largest,
  }));
}

/**
 * The one promoted candidate that misses only the maximum budget, by at most `AI_NEAR_MISS_OVER_BUDGET_SHARE`
 * (decision D4), or null. `aboveBudget` must already meet every other filter. The best tier wins, then the lowest price.
 */
export function pickNearMiss<Item>(
  aboveBudget: readonly Item[],
  featuresOf: (item: Item) => RankFeatures,
  maxPrice: number | null,
): Item | null {
  if (maxPrice === null || maxPrice <= 0) return null;
  const ceiling = Math.floor(maxPrice * (1 + AI_NEAR_MISS_OVER_BUDGET_SHARE));
  let best: { item: Item; features: RankFeatures } | null = null;
  for (const item of aboveBudget) {
    const features = featuresOf(item);
    if (features.tier === "none" || features.price === null) continue;
    if (features.price <= maxPrice || features.price > ceiling) continue;
    if (
      best === null ||
      tierIndex(features.tier) < tierIndex(best.features.tier) ||
      (features.tier === best.features.tier && features.price < (best.features.price ?? 0))
    ) {
      best = { item, features };
    }
  }
  return best?.item ?? null;
}
