import { describe, expect, it } from "vitest";
import { matchLocalities, popularLinks, quickPickLinks } from "../home-links";
import { parseSearchParams } from "../params";
import type { CuratedLocality } from "../from-card";

const CURATED: CuratedLocality[] = [
  { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 },
  { label: "Anna Nagar", lat: 13.085, lng: 80.2101, radiusKm: 4 },
  { label: "OMR Sholinganallur", lat: 12.9, lng: 80.227, radiusKm: 5 },
  { label: "Porur", lat: 13.0382, lng: 80.1565, radiusKm: 4 },
  { label: "Guindy", lat: 13.0067, lng: 80.2206, radiusKm: 3 },
];

describe("UT-search-home-links: the links of the homepage search card (S4-T06)", () => {
  it("makes the first four curated localities the Popular chips, each a link to that place", () => {
    const links = popularLinks(CURATED);
    expect(links.map((link) => link.label)).toEqual([
      "Adyar",
      "Anna Nagar",
      "OMR Sholinganallur",
      "Porur",
    ]);
    const adyar = parseSearchParams(
      new URL(links[0]?.href ?? "", "https://example.test").searchParams,
    );
    expect(adyar).toMatchObject({ place: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 });
  });

  it("carries no Buy or Rent on a chip, since a chip is not part of the card's choice", () => {
    for (const link of popularLinks(CURATED)) expect(link.href).not.toContain("listingType");
  });

  it("gives no chips when no locality is curated", () => {
    expect(popularLinks([])).toEqual([]);
  });

  it("can be asked for fewer", () => {
    expect(popularLinks(CURATED, 2)).toHaveLength(2);
  });

  it("makes the Quick picks links to three-bedroom homes and to the Budget label", () => {
    expect(quickPickLinks()).toEqual({
      bedrooms: "/properties?bhk=3",
      budget: "/properties?label=budget",
    });
  });
});

describe("UT-search-match-localities: suggestions while the visitor types (S4-T06)", () => {
  it("lists everything for an empty box, in the curated order", () => {
    expect(matchLocalities(CURATED, "").map((place) => place.label)).toEqual(
      CURATED.map((place) => place.label),
    );
    expect(matchLocalities(CURATED, "   ")).toHaveLength(CURATED.length);
  });

  it("matches anywhere in the name, ignoring capitals", () => {
    expect(matchLocalities(CURATED, "nag").map((place) => place.label)).toEqual(["Anna Nagar"]);
    expect(matchLocalities(CURATED, "OMR").map((place) => place.label)).toEqual([
      "OMR Sholinganallur",
    ]);
    expect(matchLocalities(CURATED, "an")).toHaveLength(2);
  });

  it("finds nothing for text that matches no locality", () => {
    expect(matchLocalities(CURATED, "Madurai")).toEqual([]);
  });
});
