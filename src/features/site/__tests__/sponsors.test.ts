import { describe, expect, it, vi } from "vitest";
import { selectSponsors } from "@/lib/sponsors";
import { mergeSiteSettings } from "../merge";
import { SPONSOR_BUCKET, toSponsorAds } from "../sponsors";

const SUPABASE = "https://abc.supabase.co";

const picture = (path: string, width: number, height: number) => ({ path, width, height });
const creatives = (
  name: string,
  width: number,
  height: number,
  compactWidth: number,
  compactHeight: number,
) => ({
  desktop: picture(`banners/${name}.webp`, width, height),
  compact: picture(`banners/${name}-m.webp`, compactWidth, compactHeight),
});

const AD = {
  id: "ad-1",
  active: true,
  placements: ["hero", "results"],
  alt: "Kadal Homes: new launches in Sholinganallur",
  href: "https://kadalhomes.example/launch",
  strip: creatives("strip", 970, 90, 320, 100),
  panel: creatives("panel", 524, 494, 640, 320),
};

describe("UT-sponsors-setting: the banners the site content stores", () => {
  it("turns a stored banner into what the banner area takes, with the pictures' addresses built here", () => {
    const [ad] = toSponsorAds([AD], SUPABASE);
    expect(ad).toMatchObject({
      id: "ad-1",
      active: true,
      placements: ["hero", "results"],
      alt: "Kadal Homes: new launches in Sholinganallur",
      href: "https://kadalhomes.example/launch",
    });
    expect(ad?.strip?.desktop).toEqual({
      src: `${SUPABASE}/storage/v1/object/public/${SPONSOR_BUCKET}/banners/strip.webp`,
      width: 970,
      height: 90,
    });
    expect(ad?.panel?.compact.src).toContain("/banners/panel-m.webp");
  });

  it("keeps the order, and an inactive banner (the selection leaves it out)", () => {
    const ads = toSponsorAds(
      [
        { ...AD, id: "b" },
        { ...AD, id: "a", active: false },
      ],
      SUPABASE,
    );
    expect(ads.map((ad) => ad.id)).toEqual(["b", "a"]);
    expect(selectSponsors({ ads, placement: "hero", layout: "search_desk" }).sponsors).toHaveLength(
      1,
    );
  });

  it("works with a strip only, a panel only, or both", () => {
    const [stripOnly] = toSponsorAds([{ ...AD, panel: undefined }], SUPABASE);
    expect(stripOnly?.panel).toBeUndefined();
    expect(stripOnly?.strip).toBeDefined();
    const [panelOnly] = toSponsorAds([{ ...AD, strip: undefined }], SUPABASE);
    expect(panelOnly?.strip).toBeUndefined();
  });

  it("drops a banner that does not fit, and says how many, without naming it", () => {
    const warn = vi.fn();
    const bad = [
      { ...AD, id: "http", href: "http://insecure.example" },
      { ...AD, id: "creds", href: "https://user:pass@x.example" },
      { ...AD, id: "js", href: "javascript:alert(1)" },
      { ...AD, id: "noalt", alt: "   " },
      { ...AD, id: "noplace", placements: [] },
      { ...AD, id: "oddplace", placements: ["footer"] },
      { ...AD, id: "" },
      {
        ...AD,
        id: "svg",
        strip: creatives("logo", 970, 90, 320, 100) && {
          desktop: picture("banners/x.svg", 970, 90),
          compact: picture("banners/y.webp", 320, 100),
        },
      },
      {
        ...AD,
        id: "up",
        strip: {
          desktop: picture("../secret/x.webp", 970, 90),
          compact: picture("banners/y.webp", 320, 100),
        },
      },
      {
        ...AD,
        id: "abs",
        strip: {
          desktop: picture("https://evil.example/x.webp", 970, 90),
          compact: picture("banners/y.webp", 320, 100),
        },
      },
      {
        ...AD,
        id: "size",
        strip: {
          desktop: picture("banners/x.webp", 0, 90),
          compact: picture("banners/y.webp", 320, 100),
        },
      },
      "not an object",
      null,
      42,
    ];
    expect(toSponsorAds([...bad, AD], SUPABASE, { warn })).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: bad.length });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("evil");
  });

  it("keeps the first of two banners with the same id", () => {
    const ads = toSponsorAds(
      [
        { ...AD, alt: "First" },
        { ...AD, alt: "Second" },
      ],
      SUPABASE,
    );
    expect(ads).toHaveLength(1);
    expect(ads[0]?.alt).toBe("First");
  });

  it("never lets a stored picture point at another site: only a path in our own bucket", () => {
    const [ad] = toSponsorAds([AD], SUPABASE);
    for (const image of [
      ad?.strip?.desktop,
      ad?.strip?.compact,
      ad?.panel?.desktop,
      ad?.panel?.compact,
    ]) {
      expect(image?.src.startsWith(`${SUPABASE}/storage/v1/object/public/${SPONSOR_BUCKET}/`)).toBe(
        true,
      );
    }
  });

  it("is empty for no banners", () => {
    expect(toSponsorAds([], SUPABASE)).toEqual([]);
  });
});

describe("UT-sponsors-setting: the sponsors key of the site content", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

  it("is empty by default", () => {
    expect(mergeSiteSettings([], log as never).sponsors).toEqual({ ads: [] });
  });

  it("is read from the stored row, and an unusable row is ignored by key", () => {
    const merged = mergeSiteSettings([{ key: "sponsors", value: { ads: [AD] } }], log as never);
    expect(merged.sponsors.ads).toHaveLength(1);
    const ignored = mergeSiteSettings([{ key: "sponsors", value: { ads: "nope" } }], log as never);
    expect(ignored.sponsors).toEqual({ ads: [] });
    expect(log.warn).toHaveBeenCalledWith(expect.any(String), { settingKey: "sponsors" });
  });
});
