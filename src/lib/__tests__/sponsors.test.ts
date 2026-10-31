import { describe, expect, it } from "vitest";
import { NEAR_MISS_AD, SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "../sponsors.fixtures";
import {
  fitFor,
  formatFor,
  resolveHero,
  selectSponsors,
  SLOT_RATIOS,
  type SponsorAd,
} from "../sponsors";

const ids = (
  ads: SponsorAd[],
  layout: "search_desk" | "split",
  placement: "hero" | "results" = "hero",
) => selectSponsors({ ads, placement, layout }).sponsors.map((sponsor) => sponsor.id);

describe("UT-sponsors: which format a page needs", () => {
  it("uses the strip for the Search Desk hero and for results, the panel for the split hero", () => {
    expect(formatFor("hero", "search_desk")).toBe("strip");
    expect(formatFor("hero", "split")).toBe("panel");
    expect(formatFor("results", "split")).toBe("strip");
    expect(formatFor("results", "search_desk")).toBe("strip");
  });
});

describe("UT-sponsors: fit rule (within 8% cover, within 30% contain, beyond rejected)", () => {
  const stripDesktop = SLOT_RATIOS.strip.desktop;
  const make = (width: number, height: number) => ({ src: "/x.png", width, height });

  it("fills the slot when the picture is the right shape", () => {
    expect(fitFor(make(970, 90), stripDesktop)).toBe("cover");
    expect(fitFor(make(1940, 180), stripDesktop)).toBe("cover");
    expect(fitFor(make(1000, 90), stripDesktop)).toBe("cover");
  });

  it("shows the picture whole when it is a little off", () => {
    expect(fitFor(make(970, 120), stripDesktop)).toBe("contain");
    expect(fitFor(make(524, 600), SLOT_RATIOS.panel.desktop)).toBe("contain");
  });

  it("drops a picture that is far off or broken", () => {
    expect(fitFor(make(970, 300), stripDesktop)).toBe("rejected");
    expect(fitFor(make(100, 100), stripDesktop)).toBe("rejected");
    expect(fitFor(make(0, 90), stripDesktop)).toBe("rejected");
  });
});

describe("UT-sponsors: selection matrix", () => {
  it("shows nothing when there are no sponsors", () => {
    expect(ids([], "search_desk")).toEqual([]);
    expect(ids([], "split")).toEqual([]);
  });

  it("shows one ad, and several in the admin's order", () => {
    expect(ids([SAMPLE_AD_A], "search_desk")).toEqual(["sample-a"]);
    expect(ids([SAMPLE_AD_C, SAMPLE_AD_A, SAMPLE_AD_B], "search_desk")).toEqual([
      "sample-c",
      "sample-a",
      "sample-b",
    ]);
  });

  it("skips an inactive ad and an ad meant for another placement", () => {
    const inactive = { ...SAMPLE_AD_B, active: false };
    const resultsOnly = { ...SAMPLE_AD_C, placements: ["results" as const] };
    expect(ids([SAMPLE_AD_A, inactive, resultsOnly], "search_desk")).toEqual(["sample-a"]);
    expect(ids([SAMPLE_AD_A, inactive, resultsOnly], "search_desk", "results")).toEqual([
      "sample-a",
      "sample-c",
    ]);
  });

  it("skips an ad that lacks a picture of the format in use, or one of its two pictures", () => {
    const stripOnly: SponsorAd = { ...SAMPLE_AD_B };
    delete stripOnly.panel;
    expect(ids([SAMPLE_AD_A, stripOnly], "split")).toEqual(["sample-a"]);
    expect(ids([SAMPLE_AD_A, stripOnly], "search_desk")).toEqual(["sample-a", "sample-b"]);
  });

  it("skips an ad whose picture is the wrong shape", () => {
    const wrongShape: SponsorAd = {
      ...SAMPLE_AD_B,
      strip: {
        desktop: { src: "/x.png", width: 970, height: 400 },
        compact: { src: "/x-compact.png", width: 320, height: 100 },
      },
    };
    expect(ids([wrongShape, SAMPLE_AD_A], "search_desk")).toEqual(["sample-a"]);
  });

  it("shows a near-miss picture whole, not cropped", () => {
    const { sponsors } = selectSponsors({
      ads: [NEAR_MISS_AD],
      placement: "hero",
      layout: "search_desk",
    });
    expect(sponsors).toHaveLength(1);
    expect(sponsors[0]?.fit).toBe("contain");
    const split = selectSponsors({ ads: [NEAR_MISS_AD], placement: "hero", layout: "split" });
    expect(split.sponsors[0]?.fit).toBe("contain");
  });

  it("fills the frame when every picture is the right shape", () => {
    const { sponsors } = selectSponsors({ ads: [SAMPLE_AD_A], placement: "hero", layout: "split" });
    expect(sponsors[0]?.fit).toBe("cover");
  });

  it.each(["http://sponsor.example/a", "javascript:alert(1)", "//sponsor.example/a", "/relative"])(
    "skips an ad whose link is not https (%s)",
    (href) => {
      expect(ids([{ ...SAMPLE_AD_A, href }], "search_desk")).toEqual([]);
    },
  );

  it("skips an ad with no alt text", () => {
    expect(ids([{ ...SAMPLE_AD_A, alt: "  " }], "search_desk")).toEqual([]);
  });
});

describe("UT-sponsors: the hero falls back to Search Desk without a banner", () => {
  it("keeps the split layout while a panel ad qualifies", () => {
    const hero = resolveHero([SAMPLE_AD_A], "split");
    expect(hero.arrangement).toBe("split");
    expect(hero.format).toBe("panel");
    expect(hero.sponsors).toHaveLength(1);
  });

  it("falls back to Search Desk with no banner when the split layout has no panel ad", () => {
    const stripOnly: SponsorAd = { ...SAMPLE_AD_A };
    delete stripOnly.panel;
    expect(resolveHero([stripOnly], "split")).toEqual({
      arrangement: "search_desk",
      format: "strip",
      sponsors: [],
    });
    expect(resolveHero([], "split").arrangement).toBe("search_desk");
  });

  it("keeps Search Desk and shows nothing when no strip ad qualifies", () => {
    const hero = resolveHero([], "search_desk");
    expect(hero.arrangement).toBe("search_desk");
    expect(hero.sponsors).toEqual([]);
  });
});
