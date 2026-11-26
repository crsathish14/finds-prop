import { describe, expect, it } from "vitest";
import { AI_RANKING_STRONG_MATCH } from "@/config/ai-ranking";
import { NO_PROMOTIONS, homeTier, projectTier, type PromotionLists } from "../promotions";
import {
  hasAmenity,
  inPreferredLocality,
  pickNearMiss,
  rankCandidates,
  relevanceOf,
  type RankFeatures,
  type RankWants,
} from "../rank";
import { reasonsFor } from "../reasons";

// UT-ai-ranking (ADR-205): the order of the AI search's matches, the promotion tiers and the slightly-above-budget slot.

const NO_WANTS: RankWants = {
  maxPrice: null,
  radiusKm: null,
  preferLocalities: [],
  preferAmenities: [],
  preferFurnishing: null,
};

function candidate(overrides: Partial<RankFeatures> & { id: string }): RankFeatures {
  return {
    price: 7_500_000,
    areaSqft: 1200,
    ageDays: 10,
    distanceKm: null,
    tier: "none",
    locality: "OMR Navalur",
    amenities: [],
    furnishing: null,
    completeness: 1,
    ...overrides,
  };
}

const order = (items: RankFeatures[], wants: RankWants = NO_WANTS) =>
  rankCandidates(items, (item) => item, wants).map((entry) => entry.item.id);

describe("UT-ai-ranking: the owner's example (3 BHK, Chennai, at most ₹80 L)", () => {
  // The search already left out Sponsored project A (₹1.2 Cr): it is over the budget, so it is never a candidate.
  const featuredB = candidate({ id: "featured-b", price: 7_500_000, tier: "featured" });
  const spotlightC = candidate({ id: "spotlight-c", price: 7_800_000, tier: "spotlight" });
  const regularD = candidate({ id: "regular-d", price: 7_200_000, tier: "none" });
  const wants = { ...NO_WANTS, maxPrice: 8_000_000 };

  it("orders B, C, D by tier when all three are strong matches", () => {
    expect(order([regularD, spotlightC, featuredB], wants)).toEqual([
      "featured-b",
      "spotlight-c",
      "regular-d",
    ]);
  });

  it("puts a strong regular match above a weak promoted one: promotion never manufactures relevance", () => {
    const weakSpotlight = { ...spotlightC, completeness: 0, ageDays: 900, amenities: [] };
    const wantsPool = { ...wants, preferAmenities: ["swimming pool", "gym", "clubhouse"] };
    const strongRegular = { ...regularD, amenities: ["Swimming pool", "Gym", "Clubhouse"] };
    expect(relevanceOf(weakSpotlight, wantsPool).relevance).toBeLessThan(AI_RANKING_STRONG_MATCH);
    expect(order([weakSpotlight, strongRegular], wantsPool)).toEqual(["regular-d", "spotlight-c"]);
  });

  it("offers sponsored A apart only when it is at most 10% over the budget", () => {
    const sponsoredA = candidate({ id: "sponsored-a", price: 12_000_000, tier: "sponsored" });
    expect(pickNearMiss([sponsoredA], (item) => item, 8_000_000)).toBeNull();
    const closeSponsored = { ...sponsoredA, price: 8_700_000 };
    expect(pickNearMiss([closeSponsored], (item) => item, 8_000_000)?.id).toBe("sponsored-a");
    const tooFar = { ...sponsoredA, price: 8_800_001 };
    expect(pickNearMiss([tooFar], (item) => item, 8_000_000)).toBeNull();
  });

  it("never offers an unpromoted home apart, nor anything without a budget", () => {
    const plain = candidate({ id: "plain", price: 8_100_000 });
    expect(pickNearMiss([plain], (item) => item, 8_000_000)).toBeNull();
    const sponsored = candidate({ id: "sponsored", price: 8_100_000, tier: "sponsored" });
    expect(pickNearMiss([sponsored], (item) => item, null)).toBeNull();
  });

  it("picks the best tier for the slot, then the lowest price", () => {
    const top = candidate({ id: "top", price: 8_100_000, tier: "top" });
    const featured = candidate({ id: "featured", price: 8_600_000, tier: "featured" });
    const cheaperFeatured = { ...featured, id: "cheaper-featured", price: 8_200_000 };
    expect(pickNearMiss([top, featured, cheaperFeatured], (item) => item, 8_000_000)?.id).toBe(
      "cheaper-featured",
    );
  });
});

describe("UT-ai-ranking: the promotion tiers", () => {
  const lists: PromotionLists = {
    sponsoredBuilders: new Set(["b-sponsor"]),
    sponsoredProjects: new Set(["ad-project"]),
    spotlightBuilders: new Set(["b-spot", "b-sponsor"]),
    topBuilders: new Set(["b-top", "b-sponsor", "b-spot"]),
  };

  it("gives each project its best tier once, whatever lists its builder is in", () => {
    const tier = (slug: string, builderId: string | null, featured = false) =>
      projectTier({ slug, builderId, featured }, lists);
    expect(tier("p1", "b-sponsor")).toBe("sponsored");
    expect(tier("ad-project", "b-plain")).toBe("sponsored");
    expect(tier("p2", "b-plain", true)).toBe("featured");
    expect(tier("p3", "b-spot")).toBe("spotlight");
    expect(tier("p4", "b-top")).toBe("top");
    expect(tier("p5", "b-plain")).toBe("none");
    expect(tier("p6", null)).toBe("none");
    expect(
      projectTier({ slug: "p1", builderId: "b-sponsor", featured: false }, NO_PROMOTIONS),
    ).toBe("none");
  });

  it("does not add tiers up: a builder in three lists ranks the same as one only sponsored", () => {
    const inThree = candidate({
      id: "in-three",
      tier: projectTier({ slug: "x", builderId: "b-sponsor", featured: true }, lists),
    });
    const inOne = candidate({ id: "in-one", tier: "sponsored" });
    const [first, second] = rankCandidates([inThree, inOne], (item) => item, NO_WANTS);
    expect(first?.relevance).toBe(second?.relevance);
    expect(first?.tier).toBe(second?.tier);
  });

  it("makes a home featured only when the admin featured it", () => {
    expect(homeTier({ featured: true })).toBe("featured");
    expect(homeTier({ featured: false })).toBe("none");
  });

  it("puts the tiers in the owner's order: sponsored, featured, spotlight, top, the rest", () => {
    const tiers = ["none", "top", "spotlight", "featured", "sponsored"] as const;
    const items = tiers.map((tier) => candidate({ id: tier, tier }));
    expect(order(items)).toEqual(["sponsored", "featured", "spotlight", "top", "none"]);
  });
});

describe("UT-ai-ranking: preferences rank, they never filter", () => {
  it("keeps a home without the preferred amenity, below the one that has it", () => {
    const wants = { ...NO_WANTS, preferAmenities: ["swimming pool"] };
    const ranked = rankCandidates(
      [
        candidate({ id: "no-pool", amenities: ["Gym"] }),
        candidate({ id: "pool", amenities: ["Swimming pool"] }),
      ],
      (item) => item,
      wants,
    );
    expect(ranked.map((entry) => entry.item.id)).toEqual(["pool", "no-pool"]);
    expect(ranked[1]?.missed).toEqual([{ kind: "amenity", value: "swimming pool" }]);
  });

  it("matches amenities word by word and through synonyms, and not inside another word", () => {
    expect(hasAmenity(["24x7 Security"], "security")).toBe(true);
    expect(hasAmenity(["Car Park"], "parking")).toBe(true);
    expect(hasAmenity(["Swimming pool"], "pool")).toBe(true);
    expect(hasAmenity(["Children's play area"], "play area")).toBe(true);
    expect(hasAmenity(["Parking"], "park")).toBe(false);
    expect(hasAmenity([], "gym")).toBe(false);
  });

  it("matches a preferred locality spelling-proof, either way round", () => {
    expect(inPreferredLocality("OMR Navalur", "omr")).toBe(true);
    expect(inPreferredLocality("Navalur", "OMR, Navalur")).toBe(true);
    expect(inPreferredLocality("Velachery", "OMR")).toBe(false);
    expect(inPreferredLocality(null, "OMR")).toBe(false);
  });

  it("does not count an amenity preference for a candidate whose amenities were not read", () => {
    const wants = { ...NO_WANTS, preferAmenities: ["gym"] };
    const unread = relevanceOf(candidate({ id: "unread", amenities: null }), wants);
    expect(unread.met).toEqual([]);
    expect(unread.missed).toEqual([]);
  });

  it("does not lower a home well under the budget below a weak match, but scores closer to the budget higher", () => {
    const wants = { ...NO_WANTS, maxPrice: 10_000_000 };
    const close = relevanceOf(candidate({ id: "close", price: 9_000_000 }), wants).relevance;
    const far = relevanceOf(candidate({ id: "far", price: 3_000_000 }), wants).relevance;
    expect(close).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(AI_RANKING_STRONG_MATCH);
  });
});

describe("UT-ai-ranking: facts across the matches, and a stable order", () => {
  it("marks the lowest price and the largest area, and shares them on a tie", () => {
    const ranked = rankCandidates(
      [
        candidate({ id: "a", price: 6_000_000, areaSqft: 900 }),
        candidate({ id: "b", price: 6_000_000, areaSqft: 1500 }),
        candidate({ id: "c", price: 7_000_000, areaSqft: null }),
      ],
      (item) => item,
      NO_WANTS,
    );
    const byId = new Map(ranked.map((entry) => [entry.item.id, entry]));
    expect(byId.get("a")?.lowestPrice).toBe(true);
    expect(byId.get("b")?.lowestPrice).toBe(true);
    expect(byId.get("c")?.lowestPrice).toBe(false);
    expect(byId.get("b")?.largestArea).toBe(true);
    expect(byId.get("a")?.largestArea).toBe(false);
  });

  it("gives the same order every time, newest then id on a tie", () => {
    const items = [
      candidate({ id: "z-old", ageDays: 40 }),
      candidate({ id: "b-new", ageDays: 40 }),
      candidate({ id: "a-new", ageDays: 40 }),
    ];
    expect(order(items)).toEqual(["a-new", "b-new", "z-old"]);
    expect(order([...items].reverse())).toEqual(["a-new", "b-new", "z-old"]);
  });
});

describe("UT-ai-ranking: the reasons", () => {
  it("are facts from the request and the ranking, and never name a promotion", () => {
    const [entry] = rankCandidates(
      [candidate({ id: "x", tier: "sponsored", amenities: ["Gym"], locality: "OMR Navalur" })],
      (item) => item,
      { ...NO_WANTS, preferAmenities: ["gym", "pool"], preferLocalities: ["OMR"] },
    );
    if (entry === undefined) throw new Error("nothing ranked");
    const reasons = reasonsFor(entry, { withinBudget: true, listedDaysAgo: 3 });
    expect(reasons.matchReasons).toEqual([
      "in a preferred area (OMR)",
      "has gym",
      "within the budget",
      "listed in the last week",
    ]);
    expect(reasons.missedPreferences).toEqual(["pool not listed"]);
    expect(JSON.stringify(reasons)).not.toMatch(/sponsor|featured|spotlight|promot|top/iu);
  });
});
