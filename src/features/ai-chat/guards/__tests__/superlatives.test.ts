import { describe, expect, it } from "vitest";
import { buildClaimEvidence, claimsBacked, claimsIn } from "../superlatives";

// UT-ai-claims (ADR-207): "cheapest", "largest" and "best" are said only when this turn's results back them.

const SEARCH = JSON.stringify({
  homes: [
    {
      homeId: "k3x9a2bd",
      lowestPriceOfMatches: true,
      largestOfMatches: false,
      untrustedText: { title: "Sea View Flat" },
    },
    {
      homeId: "m4y8b3ce",
      lowestPriceOfMatches: false,
      largestOfMatches: true,
      untrustedText: { title: "Garden Villa" },
    },
  ],
});

const COMPARED_PROJECTS = JSON.stringify({
  status: "compared",
  projects: [
    { slug: "kadal-vista", untrustedText: { name: "Kadal Vista" } },
    { slug: "velan-gardens", untrustedText: { name: "Velan Gardens" } },
  ],
  differences: {
    price: { lowestSlug: "velan-gardens", highestSlug: "kadal-vista", gapText: "₹30 L" },
    pricePerSqft: null,
  },
});

const COMPARED_HOMES = JSON.stringify({
  status: "compared",
  homes: [{ homeId: "n5z7c4dh" }, { homeId: "p6a8d5ej" }],
  differences: {
    price: { lowestHomeId: "p6a8d5ej", highestHomeId: "n5z7c4dh" },
    area: { lowestHomeId: "p6a8d5ej", highestHomeId: "n5z7c4dh" },
  },
});

const home = (homeId: string) => ({ kind: "home" as const, homeId, slug: "s" });
const project = (slug: string) => ({ kind: "project" as const, slug });

describe("UT-ai-claims: what counts as a claim", () => {
  it.each([
    ["this is the cheapest home here", ["price"]],
    ["it has the lowest price of the three", ["price"]],
    ["the best deal in velachery", ["price"]],
    ["it is the biggest of them", ["size"]],
    ["kadal vista is the best project in chennai", ["quality"]],
    ["they are the number one builder", ["quality"]],
    ["this is the best option", ["quality"]],
  ])("finds a claim in %s", (text, kinds) => {
    expect(claimsIn(text)).toEqual(kinds);
  });

  it.each([
    "here are the best matches for your search",
    "the best fit depends on whether you want a pool",
    "kadal vista may be the best choice if you want an earlier possession",
    "there is no single best project; it depends on what matters to you",
    "i will do my best to help",
    "it is a good home near the beach",
  ])("finds none in %s", (text) => {
    expect(claimsIn(text)).toEqual([]);
  });
});

describe("UT-ai-claims: a claim is let through only when a result backs it", () => {
  const evidence = buildClaimEvidence([SEARCH, COMPARED_PROJECTS, COMPARED_HOMES], "2 bhk homes");

  it("backs the lowest and largest a search marks, by card or by name", () => {
    expect(claimsBacked("this is the cheapest home.", [home("k3x9a2bd")], evidence)).toBe(true);
    expect(claimsBacked("sea view flat is the cheapest of them.", [], evidence)).toBe(true);
    expect(claimsBacked("garden villa is the largest.", [], evidence)).toBe(true);
    expect(claimsBacked("this is the cheapest home.", [home("m4y8b3ce")], evidence)).toBe(false);
    expect(claimsBacked("garden villa is the cheapest.", [], evidence)).toBe(false);
  });

  it("backs the lower price and larger area a comparison names", () => {
    expect(claimsBacked("velan gardens is the cheapest of the two.", [], evidence)).toBe(true);
    expect(claimsBacked("kadal vista is the cheapest of the two.", [], evidence)).toBe(false);
    expect(claimsBacked("this one is the largest.", [home("n5z7c4dh")], evidence)).toBe(true);
    expect(claimsBacked("this one is the cheapest.", [project("kadal-vista")], evidence)).toBe(
      false,
    );
  });

  it("never backs a quality claim", () => {
    expect(claimsBacked("velan gardens is the best project.", [], evidence)).toBe(false);
    expect(claimsBacked("it is the best home.", [home("k3x9a2bd")], evidence)).toBe(false);
  });

  it("lets a sentence that names no record through only when the turn backs it or the customer asked", () => {
    const none = buildClaimEvidence([], "show me homes in adyar");
    expect(claimsBacked("here are the cheapest ones i found.", [], none)).toBe(false);
    const asked = buildClaimEvidence([], "show me the cheapest homes in adyar");
    expect(claimsBacked("here are the cheapest ones i found.", [], asked)).toBe(true);
    expect(claimsBacked("here are the cheapest ones i found.", [], evidence)).toBe(true);
  });

  it("reads nothing that is not JSON, and lets a sentence without a claim through", () => {
    const broken = buildClaimEvidence(["not json"], "");
    expect(claimsBacked("this home has a pool.", [], broken)).toBe(true);
    expect(claimsBacked("this is the cheapest home.", [], broken)).toBe(false);
  });
});
