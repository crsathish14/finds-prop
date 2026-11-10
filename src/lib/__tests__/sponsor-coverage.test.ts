import { describe, expect, it } from "vitest";
import { heroCoverage } from "../sponsor-coverage";
import type { SponsorAd } from "../sponsors";
import { NEAR_MISS_AD, SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "../sponsors.fixtures";

const stripOnly = (ad: SponsorAd): SponsorAd => ({
  id: ad.id,
  active: ad.active,
  placements: ad.placements,
  alt: ad.alt,
  href: ad.href,
  ...(ad.strip ? { strip: ad.strip } : {}),
});

describe("UT-sponsor-coverage: which sponsors can show in the hero (S7-T11, FR-ADM-11)", () => {
  it("Search Desk needs the strip and Split needs the panel", () => {
    expect(heroCoverage([SAMPLE_AD_A], "search_desk").format).toBe("strip");
    expect(heroCoverage([SAMPLE_AD_A], "split").format).toBe("panel");
  });

  it("every active sponsor with the format shows, in the admin's order, and none is missing", () => {
    const result = heroCoverage([SAMPLE_AD_B, SAMPLE_AD_A], "split");
    expect(result).toEqual({
      format: "panel",
      active: 2,
      shown: ["sample-b", "sample-a"],
      missing: 0,
    });
  });

  it("counts the active sponsors that lack the format as missing", () => {
    const strip = stripOnly(SAMPLE_AD_B);
    const nothing: SponsorAd = {
      id: "c",
      active: true,
      placements: ["hero"],
      alt: SAMPLE_AD_C.alt,
      href: SAMPLE_AD_C.href,
    };
    const result = heroCoverage([SAMPLE_AD_A, strip, nothing], "split");
    expect(result.shown).toEqual(["sample-a"]);
    expect(result.active).toBe(3);
    expect(result.missing).toBe(2);
  });

  it("does not count a sponsor that is switched off, either as shown or as missing", () => {
    const off: SponsorAd = { ...SAMPLE_AD_A, id: "off", active: false };
    const result = heroCoverage([off, SAMPLE_AD_B], "search_desk");
    expect(result).toEqual({ format: "strip", active: 1, shown: ["sample-b"], missing: 0 });
  });

  it("a sponsor whose picture is a near miss still shows (whole, on a plain background)", () => {
    expect(heroCoverage([NEAR_MISS_AD], "search_desk").shown).toEqual(["sample-near-miss"]);
  });

  it("a sponsor meant only for the results list is not a hero sponsor", () => {
    const resultsOnly: SponsorAd = { ...SAMPLE_AD_A, placements: ["results"] };
    expect(heroCoverage([resultsOnly], "search_desk")).toEqual({
      format: "strip",
      active: 1,
      shown: [],
      missing: 1,
    });
  });

  it("nothing at all: nothing shown and nothing missing", () => {
    expect(heroCoverage([], "split")).toEqual({
      format: "panel",
      active: 0,
      shown: [],
      missing: 0,
    });
  });
});
