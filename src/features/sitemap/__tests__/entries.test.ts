import { describe, expect, it } from "vitest";
import {
  homesRoom,
  SITEMAP_MAX_URLS,
  sitemapEntries,
  STATIC_PATHS,
  type SitemapHome,
} from "../entries";

const ORIGIN = "https://findsprop.test";

const home = (shortId: string, overrides: Partial<SitemapHome> = {}): SitemapHome => ({
  slug: "3-bhk-apartment",
  shortId,
  updatedAt: "2026-11-02T10:30:00+00:00",
  ...overrides,
});

describe("UT-sitemap: the entries", () => {
  it("starts with the built public pages: the homepage only: the lists are for signed-in visitors", () => {
    const entries = sitemapEntries({ origin: ORIGIN, homes: [], projects: [] });
    expect(entries.map((entry) => entry.url)).toEqual(["https://findsprop.test/"]);
    expect(STATIC_PATHS).toHaveLength(1);
  });

  it("lists each project and each home by its canonical address, with the date it last changed", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      projects: [{ slug: "kadal-vista", updatedAt: "2026-11-03T08:00:00+00:00" }],
      homes: [home("k3x9a2bd")],
    });
    expect(entries.slice(1)).toEqual([
      {
        url: "https://findsprop.test/projects/kadal-vista",
        lastModified: new Date("2026-11-03T08:00:00+00:00"),
      },
      {
        url: "https://findsprop.test/properties/3-bhk-apartment-k3x9a2bd",
        lastModified: new Date("2026-11-02T10:30:00+00:00"),
      },
    ]);
  });

  it("leaves the date off an entry whose date does not read as one", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      projects: [],
      homes: [home("k3x9a2bd", { updatedAt: "not a date" })],
    });
    expect(entries[1]?.lastModified).toBeUndefined();
  });

  it("never holds more than 45,000 addresses, the pages and projects counted first", () => {
    const homes = Array.from({ length: SITEMAP_MAX_URLS + 10 }, (_, index) =>
      home(String(index).padStart(8, "0")),
    );
    const entries = sitemapEntries({
      origin: ORIGIN,
      projects: [{ slug: "kadal-vista", updatedAt: "2026-11-03T08:00:00+00:00" }],
      homes,
    });
    expect(entries).toHaveLength(SITEMAP_MAX_URLS);
    expect(entries[1]?.url).toBe("https://findsprop.test/projects/kadal-vista");
  });

  it("leaves room for homes once the pages and projects are counted", () => {
    expect(homesRoom(0)).toBe(SITEMAP_MAX_URLS - 1);
    expect(homesRoom(12)).toBe(SITEMAP_MAX_URLS - 13);
    expect(homesRoom(SITEMAP_MAX_URLS * 2)).toBe(0);
  });

  it("lists the FAQ page after the fixed pages when it is given one, with its date, and not otherwise", () => {
    const withFaq = sitemapEntries({
      origin: ORIGIN,
      homes: [],
      projects: [],
      faq: { updatedAt: "2026-11-20T10:00:00+00:00" },
    });
    expect(withFaq[1]).toEqual({
      url: "https://findsprop.test/faq",
      lastModified: new Date("2026-11-20T10:00:00+00:00"),
    });
    for (const without of [
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [], faq: null }),
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [] }),
    ]) {
      expect(without.map((entry) => entry.url)).not.toContain("https://findsprop.test/faq");
    }
  });

  it("lists the Blog list with the newest article's date, and then the articles after the homes, only when given some", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      homes: [{ slug: "flat", shortId: "ab12cd34", updatedAt: "2026-11-02T10:30:00+00:00" }],
      projects: [],
      blog: {
        posts: [
          { slug: "stamp-duty-explained", updatedAt: "2026-11-10T08:00:00+00:00" },
          { slug: "renting-in-chennai", updatedAt: "2026-11-18T08:00:00+00:00" },
        ],
      },
    });
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://findsprop.test/",
      "https://findsprop.test/blog",
      "https://findsprop.test/properties/flat-ab12cd34",
      "https://findsprop.test/blog/stamp-duty-explained",
      "https://findsprop.test/blog/renting-in-chennai",
    ]);
    expect(entries[1]?.lastModified).toEqual(new Date("2026-11-18T08:00:00+00:00"));
    expect(entries[3]?.lastModified).toEqual(new Date("2026-11-10T08:00:00+00:00"));
    for (const without of [
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [], blog: null }),
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [], blog: { posts: [] } }),
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [] }),
    ]) {
      expect(without.map((entry) => entry.url).join(" ")).not.toContain("/blog");
    }
  });

  it("lists the Careers list with the newest job date, and then the jobs after the homes, only when given some", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      homes: [{ slug: "flat", shortId: "ab12cd34", updatedAt: "2026-11-02T10:30:00+00:00" }],
      projects: [],
      careers: {
        jobs: [
          { slug: "site-engineer", updatedAt: "2026-11-10T08:00:00+00:00" },
          { slug: "sales-lead", updatedAt: "2026-11-18T08:00:00+00:00" },
        ],
      },
    });
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://findsprop.test/",
      "https://findsprop.test/careers",
      "https://findsprop.test/properties/flat-ab12cd34",
      "https://findsprop.test/careers/site-engineer",
      "https://findsprop.test/careers/sales-lead",
    ]);
    expect(entries[1]?.lastModified).toEqual(new Date("2026-11-18T08:00:00+00:00"));
    for (const without of [
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [], careers: null }),
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [], careers: { jobs: [] } }),
      sitemapEntries({ origin: ORIGIN, homes: [], projects: [] }),
    ]) {
      expect(without.map((entry) => entry.url).join(" ")).not.toContain("/careers");
    }
  });

  it("cuts the Blog's articles before it cuts homes when the cap is reached", () => {
    const homes = Array.from({ length: SITEMAP_MAX_URLS }, (_, index) => ({
      slug: "home",
      shortId: String(index).padStart(8, "0"),
      updatedAt: "2026-11-02T10:30:00+00:00",
    }));
    const entries = sitemapEntries({
      origin: ORIGIN,
      projects: [],
      homes,
      blog: { posts: [{ slug: "late", updatedAt: "2026-11-10T08:00:00+00:00" }] },
    });
    expect(entries).toHaveLength(SITEMAP_MAX_URLS);
    expect(entries.map((entry) => entry.url)).not.toContain("https://findsprop.test/blog/late");
  });
});
