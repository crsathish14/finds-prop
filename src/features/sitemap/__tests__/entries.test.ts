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
  it("starts with the built public pages: the homepage and the two lists", () => {
    const entries = sitemapEntries({ origin: ORIGIN, homes: [], projects: [] });
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://findsprop.test/",
      "https://findsprop.test/properties",
      "https://findsprop.test/projects",
    ]);
    expect(STATIC_PATHS).toHaveLength(3);
  });

  it("lists each project and each home by its canonical address, with the date it last changed", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      projects: [{ slug: "kadal-vista", updatedAt: "2026-11-03T08:00:00+00:00" }],
      homes: [home("k3x9a2bd")],
    });
    expect(entries.slice(3)).toEqual([
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
    expect(entries[3]?.lastModified).toBeUndefined();
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
    expect(entries[3]?.url).toBe("https://findsprop.test/projects/kadal-vista");
  });

  it("leaves room for homes once the pages and projects are counted", () => {
    expect(homesRoom(0)).toBe(SITEMAP_MAX_URLS - 3);
    expect(homesRoom(12)).toBe(SITEMAP_MAX_URLS - 15);
    expect(homesRoom(SITEMAP_MAX_URLS * 2)).toBe(0);
  });
});
