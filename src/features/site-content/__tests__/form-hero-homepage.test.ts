import { describe, expect, it } from "vitest";
import {
  heroFormOf,
  heroPayloadOf,
  heroPictureOf,
  heroProblemsOf,
  homepageFormOf,
  homepagePayloadOf,
  homepagePictureOf,
  localityProblemsOf,
  localityRowsOf,
  standardHeroOf,
  type StandardHero,
} from "../form";

const STANDARD: StandardHero = {
  title: "Find the place that fits your life in Tamil Nadu.",
  subtitle: "Shortlist, compare and enquire directly.",
};

describe("UT-hero-form: the Hero page's boxes (S7-T10)", () => {
  it("starts the headline on what visitors see today when none is saved, and the other boxes empty", () => {
    expect(heroFormOf({ layout: "search_desk" }, STANDARD)).toEqual({
      eyebrow: "",
      title: STANDARD.title,
      subtitle: "",
      layout: "search_desk",
    });
  });

  it("starts on what is saved, the layout included", () => {
    expect(
      heroFormOf(
        { eyebrow: "Tamil Nadu", title: "Homes", subtitle: "Compare.", layout: "split" },
        STANDARD,
      ),
    ).toEqual({ eyebrow: "Tamil Nadu", title: "Homes", subtitle: "Compare.", layout: "split" });
  });

  it("takes the standard from what buildHero returned, dropping its extras", () => {
    expect(standardHeroOf({ title: "Find it in Tamil Nadu.", subtitle: "Compare." })).toEqual({
      title: "Find it in Tamil Nadu.",
      subtitle: "Compare.",
    });
  });

  it("sends the four values as they are", () => {
    const values = { eyebrow: "E", title: "T", subtitle: "S", layout: "split" as const };
    expect(heroPayloadOf(values)).toEqual(values);
  });

  it("puts each problem on its box", () => {
    expect(
      heroProblemsOf({ title: "needed", eyebrow: "long", subtitle: "long", layout: "bad" }),
    ).toEqual({ title: "needed", eyebrow: "long", subtitle: "long" });
    expect(heroProblemsOf({})).toEqual({});
  });

  it("draws the typed words, and the standard headline and subtitle where a box is empty", () => {
    expect(
      heroPictureOf(
        { eyebrow: " Tamil Nadu ", title: "", subtitle: "", layout: "split" },
        STANDARD,
      ),
    ).toEqual({
      title: STANDARD.title,
      subtitle: STANDARD.subtitle,
      eyebrow: "Tamil Nadu",
      layout: "split",
    });
    expect(
      heroPictureOf(
        { eyebrow: "", title: " Homes ", subtitle: " Compare. ", layout: "search_desk" },
        STANDARD,
      ),
    ).toEqual({ title: "Homes", subtitle: "Compare.", layout: "search_desk" });
  });
});

const SAVED = {
  showFeatured: true,
  showProjectTypes: false,
  showDiscovery: true,
  showWhyUs: true,
  showCta: false,
  localities: [
    { label: "Adyar", lat: 13.0067, lng: 80.2573, radiusKm: 4 },
    { label: "Navalur", lat: 12.8458, lng: 80.2265, radiusKm: 6 },
  ],
};

describe("UT-homepage-form: the Homepage page's boxes (S7-T10)", () => {
  it("starts on the saved switches, with the localities' numbers as the text a box holds", () => {
    expect(homepageFormOf(SAVED)).toEqual({
      ...SAVED,
      localities: [
        { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "4" },
        { label: "Navalur", lat: "12.8458", lng: "80.2265", radiusKm: "6" },
      ],
    });
  });

  it("numbers the rows by place, and sends the switches and the typed localities without the ids", () => {
    const form = homepageFormOf(SAVED);
    const rows = localityRowsOf(form.localities, "place");
    expect(rows.map((row) => row.id)).toEqual(["place-1", "place-2"]);
    expect(homepagePayloadOf({ ...form, localities: rows })).toEqual({
      showFeatured: true,
      showProjectTypes: false,
      showDiscovery: true,
      showWhyUs: true,
      showCta: false,
      localities: form.localities,
    });
  });

  it("puts a locality problem on the row at that place and ignores a place with no row", () => {
    const rows = [{ id: "place-1" }, { id: "place-2" }];
    expect(
      localityProblemsOf(
        {
          "localities.1.lat": "outside",
          "localities.1.label": "taken",
          "localities.0.radiusKm": "bad",
          "localities.7.lat": "gone",
          localities: "too many",
        },
        rows,
      ),
    ).toEqual({
      "place-2": { lat: "outside", label: "taken" },
      "place-1": { radiusKm: "bad" },
    });
  });

  it("draws the sections in the page's order, the first four localities as chips and all as tiles", () => {
    const picture = homepagePictureOf({
      ...homepageFormOf(SAVED),
      localities: ["A", "B", "C", "D", "E"].map((label) => ({ label })),
    });
    expect(picture.sections).toEqual([
      { key: "hero", on: true },
      { key: "discovery", on: true },
      { key: "featured", on: true },
      { key: "projectTypes", on: false },
      { key: "whyUs", on: true },
      { key: "cta", on: false },
    ]);
    expect(picture.popular).toEqual(["A", "B", "C", "D"]);
    expect(picture.tiles).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("draws the locality section Off when there is no named place, even with its switch on", () => {
    const picture = homepagePictureOf({
      ...homepageFormOf(SAVED),
      localities: [{ label: "  " }],
    });
    expect(picture.sections.find((section) => section.key === "discovery")?.on).toBe(false);
    expect(picture.tiles).toEqual([]);
  });
});
