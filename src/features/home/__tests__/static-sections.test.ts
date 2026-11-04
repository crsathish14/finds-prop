import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { buildBrowseCards, buildExploreTiles, buildValueCards } from "../static-sections";

const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

const CURATED = [
  { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 },
  { label: "Anna Nagar", lat: 13.085, lng: 80.2101, radiusKm: 4 },
  { label: "OMR Sholinganallur", lat: 12.9, lng: 80.227, radiusKm: 5 },
  { label: "Porur", lat: 13.0382, lng: 80.1565, radiusKm: 4 },
  { label: "Guindy", lat: 13.0067, lng: 80.2206, radiusKm: 3 },
  { label: "Velachery", lat: 12.9815, lng: 80.218, radiusKm: 3 },
];

describe("UT-home-explore-tiles: the tiles of Explore by locality (DEC-13)", () => {
  it("makes a tile for each curated locality, in order, leading to the homes around it", () => {
    const tiles = buildExploreTiles(CURATED);
    expect(tiles.map((tile) => tile.name)).toEqual(CURATED.map((place) => place.label));
    expect(tiles[0]?.href).toBe("/properties?lat=13.0012&lng=80.2565&place=Adyar&r=3");
  });

  it("goes round the five tints of the UX", () => {
    expect(buildExploreTiles(CURATED).map((tile) => tile.tint)).toEqual([1, 2, 3, 4, 5, 1]);
  });

  it("keeps every key different, even for two places with the same name", () => {
    const twice = buildExploreTiles([...CURATED.slice(0, 1), ...CURATED.slice(0, 1)]);
    expect(new Set(twice.map((tile) => tile.key)).size).toBe(2);
  });

  it("gives no tile when no locality is curated", () => {
    expect(buildExploreTiles([])).toEqual([]);
  });
});

describe("UT-home-browse-cards: the cards of Browse by what matters (BR-92)", () => {
  it("leads Featured, Prime and Budget to the homes with that label, and By locality to the results", () => {
    const cards = buildBrowseCards(translate);
    expect(cards.map((card) => [card.key, card.href])).toEqual([
      ["featured", "/properties?label=featured"],
      ["prime", "/properties?label=prime"],
      ["budget", "/properties?label=budget"],
      ["locality", "/properties"],
    ]);
  });

  it("uses the words of the UX, in its four tints", () => {
    const cards = buildBrowseCards(translate);
    expect(cards.map((card) => card.title)).toEqual(["Featured", "Prime", "Budget", "By locality"]);
    expect(cards[0]?.description).toBe("Hand-picked homes we recommend first");
    expect(cards.map((card) => card.tint)).toEqual([1, 2, 3, 4]);
  });

  it("names no place in the last line when the site content has no region (DEC-14)", () => {
    expect(buildBrowseCards(translate)[3]?.description).toBe("Browse homes area by area");
    expect(buildBrowseCards(translate, "  ")[3]?.description).toBe("Browse homes area by area");
  });

  it("names the region in the last line when the site content has one", () => {
    expect(buildBrowseCards(translate, "Chennai")[3]?.description).toBe(
      "Browse homes area by area across Chennai",
    );
  });
});

describe("UT-home-value-cards: the cards of Why Find Prop", () => {
  it("has the three reasons of the UX, with the brand name in the first", () => {
    const cards = buildValueCards(translate, "Find Prop");
    expect(cards.map((card) => card.title)).toEqual([
      "Approved listings only",
      "Enquire directly",
      "Shortlist and compare",
    ]);
    expect(cards[0]?.description).toBe("Homes appear on Find Prop after they are approved.");
  });

  it("uses the brand name the site content gives", () => {
    expect(buildValueCards(translate, "Grove Homes")[0]?.description).toBe(
      "Homes appear on Grove Homes after they are approved.",
    );
  });
});
