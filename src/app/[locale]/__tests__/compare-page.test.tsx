import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));
vi.mock("@/features/home", () => ({
  LISTING_BUCKET: "listing-media",
  publicStorageUrl: () => "",
}));
vi.mock("@/features/compare", () => ({
  CompareScreen: () => null,
  compareHref: () => "/compare",
  getComparedProperties: async () => [],
  parseIdsParam: () => [],
  toCompareColumn: () => ({}),
}));

const { generateMetadata } = await import("../(public)/compare/page");

describe("the comparison page's metadata (FR-PUB-14)", () => {
  it("is titled, and is neither indexed nor followed", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("compare.title");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
