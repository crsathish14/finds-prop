import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";

/** A translator that reads the real English messages, so the page says what it will say live. */
function translate(key: string, values: Record<string, unknown> = {}): string {
  let node: unknown = en;
  for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`no message ${key}`);
  return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
}

vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/site", () => ({
  getTranslate: async () => translate,
  getSiteSettings: async () => ({ region: {}, homepage: { localities: [] } }),
  getFeatureFlags: () => ({ aiSearch: false }),
  getSponsorAds: async () => [],
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));
vi.mock("@/components/domain/property-card", () => ({ PropertyCard: () => null }));
vi.mock("@/components/layout/sponsor-slot", () => ({ SponsorSlot: () => null }));
vi.mock("@/features/compare", () => ({ CompareCardToggle: () => null }));
vi.mock("@/features/home", () => ({ toPropertyCard: () => ({}) }));

const wall = vi.hoisted(() => ({ href: null as string | null }));
vi.mock("@/features/login-wall", () => ({
  isSignedOut: async () => wall.href !== null,
  loginWallMetadata: () => ({ title: "wall title", robots: { index: false, follow: false } }),
  LoginWallScreen: () => null,
}));

const searchResults = vi.hoisted(() => vi.fn());
const screenProps = vi.hoisted(() => vi.fn());
vi.mock("@/features/search", async () => {
  const params = await vi.importActual<Record<string, unknown>>("@/features/search/params");
  const view = await vi.importActual<Record<string, unknown>>("@/features/search/results-view");
  const nearby = await vi.importActual<Record<string, unknown>>("@/features/search/nearby");
  return {
    NEARBY_RADIUS_KM: nearby["NEARBY_RADIUS_KM"],
    nearbyHomesToShow: nearby["nearbyHomesToShow"],
    nearbySearchParams: nearby["nearbySearchParams"],
    wantsNearby: nearby["wantsNearby"],
    searchRadiusKm: params["searchRadiusKm"],
    parseSearchParams: params["parseSearchParams"],
    canonicalSearchHref: params["canonicalSearchHref"],
    canonicalRedirect: view["canonicalRedirect"],
    resultsMeta: view["resultsMeta"],
    getSearchResults: searchResults,
    ResultsScreen: (props: unknown) => {
      screenProps(props);
      return null;
    },
  };
});

const { default: PropertiesPage, generateMetadata } = await import("../(public)/properties/page");

const search = (raw: Record<string, string | string[] | undefined>) => ({
  searchParams: Promise.resolve(raw),
});

beforeEach(() => {
  wall.href = null;
});

describe("the results page for a visitor who is not signed in (login wall)", () => {
  it("reads no home, and returns the wall, which holds the sign-in", async () => {
    wall.href = "signed-out";
    searchResults.mockClear();
    const element = await PropertiesPage(search({ bhk: "3" }));
    expect(searchResults).not.toHaveBeenCalled();
    expect(JSON.stringify(element)).toContain('"kind":"properties"');
  });

  it("has one generic title, whatever the filters, and is not indexed", async () => {
    wall.href = "signed-out";
    const metadata = await generateMetadata(search({ bhk: "3", listingType: "rent" }));
    expect(metadata.title).toBe("wall title");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});

describe("the results page's metadata (FR-PUB-14)", () => {
  it("is the plain title, with the list as its canonical address, when nothing is filtered", async () => {
    const metadata = await generateMetadata(search({}));
    expect(metadata.title).toBe("Properties");
    expect(metadata.alternates?.canonical).toBe("/properties");
    expect(metadata.openGraph).toMatchObject({ url: "/properties", siteName: "findsprop" });
  });

  it("is titled and described by the search", async () => {
    const metadata = await generateMetadata(
      search({ listingType: "sale", propertyType: "apartment", locality: "Velachery" }),
    );
    expect(metadata.title).toBe("Apartments for sale in Velachery");
    expect(metadata.description).toContain("Apartments for sale in Velachery");
    expect(metadata.alternates?.canonical).toBe(
      "/properties?listingType=sale&locality=Velachery&propertyType=apartment",
    );
  });

  it("gives the same canonical address however the homes are laid out", async () => {
    const grid = await generateMetadata(search({ bhk: "3" }));
    const list = await generateMetadata(
      search({ bhk: "3", view: "list", sort: "price_asc", show: "24" }),
    );
    expect(list.alternates?.canonical).toBe(grid.alternates?.canonical);
    expect(grid.alternates?.canonical).toBe("/properties?bhk=3");
  });

  it("reads a repeated or broken parameter as the page itself does", async () => {
    const metadata = await generateMetadata(search({ bhk: ["3", "4"], listingType: "nonsense" }));
    expect(metadata.alternates?.canonical).toBe("/properties?bhk=3");
  });
});

describe("the results page's Also near read (ADR-137, FR-GEO-03)", () => {
  const PLACE = { place: "Velachery", lat: "12.98", lng: "80.22" };
  const row = (shortId: string, distance = 1) => ({
    short_id: shortId,
    slug: `home-${shortId}`,
    title: shortId,
    distance_km: distance,
  });
  const rows = (from: number, count: number) =>
    Array.from({ length: count }, (_value, index) => row(`h${from + index}`, index + 1));
  const ok = (homes: unknown[], total = homes.length) => ({ status: "ok", homes, total });

  async function render(raw: Record<string, string>) {
    const element = await PropertiesPage(search(raw));
    // The page is `<main><ResultsScreen .../></main>`; the mocked screen records its props when drawn.
    const { renderToStaticMarkup } = await import("react-dom/server");
    renderToStaticMarkup(createElement(() => element));
    return screenProps.mock.calls.at(-1)?.[0] as {
      total: number;
      shown: number;
      nearby?: { count: number; radiusKm: number; cards: unknown[] };
    };
  }

  beforeEach(() => {
    searchResults.mockReset();
    screenProps.mockReset();
  });

  it("reads again in 15 km, nearest first, when the circle has fewer than six homes, and removes the homes already shown", async () => {
    searchResults.mockImplementation(async (params: { radiusKm?: number; sort: string }) =>
      params.radiusKm === 15 ? ok([...rows(1, 3), ...rows(4, 20)], 23) : ok(rows(1, 3)),
    );
    const props = await render(PLACE);
    expect(searchResults).toHaveBeenCalledTimes(2);
    expect(searchResults.mock.calls[1]?.[0]).toMatchObject({ radiusKm: 15, sort: "distance" });
    // The headline and the list are the circle's own.
    expect(props.total).toBe(3);
    expect(props.shown).toBe(3);
    expect(props.nearby).toMatchObject({ count: 12, radiusKm: 15 });
  });

  it("reads once, and draws no section, with six homes or more", async () => {
    searchResults.mockResolvedValue(ok(rows(1, 6), 6));
    const props = await render(PLACE);
    expect(searchResults).toHaveBeenCalledTimes(1);
    expect(props.nearby).toBeUndefined();
  });

  it("reads once without a place, and once when the circle is already 15 km", async () => {
    searchResults.mockResolvedValue(ok(rows(1, 2), 2));
    await render({ locality: "Adyar" });
    await render({ ...PLACE, ["r"]: "15" });
    expect(searchResults).toHaveBeenCalledTimes(2);
  });

  it("draws no section when the wider search adds no home or fails", async () => {
    searchResults.mockResolvedValue(ok(rows(1, 3), 3));
    expect((await render(PLACE)).nearby).toBeUndefined();
    searchResults.mockImplementation(async (params: { radiusKm?: number }) =>
      params.radiusKm === 15 ? { status: "failed" } : ok(rows(1, 3), 3),
    );
    expect((await render(PLACE)).nearby).toBeUndefined();
  });

  it("does not look further out when the main read failed", async () => {
    searchResults.mockResolvedValue({ status: "failed" });
    expect((await render(PLACE)).nearby).toBeUndefined();
    expect(searchResults).toHaveBeenCalledTimes(1);
  });

  it("still gives the section when the circle holds no home at all", async () => {
    searchResults.mockImplementation(async (params: { radiusKm?: number }) =>
      params.radiusKm === 15 ? ok(rows(1, 4), 4) : ok([], 0),
    );
    const props = await render(PLACE);
    expect(props.total).toBe(0);
    expect(props.nearby).toMatchObject({ count: 4 });
  });
});
