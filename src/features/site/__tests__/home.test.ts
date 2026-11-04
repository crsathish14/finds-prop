import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { SITE_DEFAULTS } from "../defaults";
import { buildHero } from "../home";
import type { SiteSettings } from "../schemas";

/** A translator over the real catalogue, filling {placeholders} the way next-intl would. */
const translate: Translate = (key, values) => {
  const message = key.split(".").reduce<unknown>((node, part) => {
    return (node as Record<string, unknown>)[part];
  }, en);
  if (typeof message !== "string") throw new Error(`no message ${key}`);
  return message.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name]));
};

function settings(change: {
  hero?: Partial<SiteSettings["hero"]>;
  region?: Partial<SiteSettings["region"]>;
}): SiteSettings {
  return {
    ...SITE_DEFAULTS,
    hero: { ...SITE_DEFAULTS.hero, ...change.hero },
    region: { ...SITE_DEFAULTS.region, ...change.region },
  };
}

describe("UT-site-hero-text: the words of the homepage hero (S4-T06, DEC-14)", () => {
  it("is region-neutral when the site content names no region and writes no headline", () => {
    expect(buildHero(SITE_DEFAULTS, translate)).toEqual({
      title: "Find the place that fits your life.",
      subtitle: "Shortlist, compare and enquire directly.",
    });
  });

  it("names the region, in copper, when the site content has one", () => {
    expect(buildHero(settings({ region: { name: "Chennai" } }), translate)).toEqual({
      title: "Find the place that fits your life in Chennai.",
      emphasis: "Chennai",
      subtitle: "Shortlist, compare and enquire directly.",
    });
  });

  it("shows a headline written in the site content as given, with no copper word", () => {
    const hero = buildHero(
      settings({
        hero: { title: "Homes across Tamil Nadu" },
        region: { name: "Chennai" },
      }),
      translate,
    );
    expect(hero.title).toBe("Homes across Tamil Nadu");
    expect(hero).not.toHaveProperty("emphasis");
  });

  it("uses the line written in the site content over the catalogue's", () => {
    expect(
      buildHero(settings({ hero: { subtitle: "Owners and builders, direct." } }), translate),
    ).toMatchObject({ subtitle: "Owners and builders, direct." });
  });

  it("treats an empty or blank setting as no setting", () => {
    const hero = buildHero(
      settings({ hero: { title: "   ", subtitle: "" }, region: { name: " " } }),
      translate,
    );
    expect(hero).toEqual({
      title: "Find the place that fits your life.",
      subtitle: "Shortlist, compare and enquire directly.",
    });
  });

  it("trims the words it takes from the site content", () => {
    const hero = buildHero(settings({ region: { name: "  Madurai " } }), translate);
    expect(hero.title).toBe("Find the place that fits your life in Madurai.");
    expect(hero.emphasis).toBe("Madurai");
  });
});
