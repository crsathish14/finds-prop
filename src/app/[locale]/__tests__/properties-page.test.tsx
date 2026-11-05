import { describe, expect, it, vi } from "vitest";
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
vi.mock("@/features/search", async () => {
  const params = await vi.importActual<Record<string, unknown>>("@/features/search/params");
  const view = await vi.importActual<Record<string, unknown>>("@/features/search/results-view");
  return {
    parseSearchParams: params["parseSearchParams"],
    canonicalSearchHref: params["canonicalSearchHref"],
    canonicalRedirect: view["canonicalRedirect"],
    resultsMeta: view["resultsMeta"],
    getSearchResults: async () => ({ status: "ok", homes: [], total: 0 }),
    ResultsScreen: () => null,
  };
});

const { generateMetadata } = await import("../(public)/properties/page");

const search = (raw: Record<string, string | string[] | undefined>) => ({
  searchParams: Promise.resolve(raw),
});

describe("the results page's metadata (FR-PUB-14)", () => {
  it("is the plain title, with the list as its canonical address, when nothing is filtered", async () => {
    const metadata = await generateMetadata(search({}));
    expect(metadata.title).toBe("Properties");
    expect(metadata.alternates?.canonical).toBe("/properties");
    expect(metadata.openGraph).toMatchObject({ url: "/properties", siteName: "Find Prop" });
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
