import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const { getProperty } = await import("../queries");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  short_id: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK apartment",
  description: "A bright apartment.",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12_500_000,
  furnishing: "semi",
  amenities: ["Gym"],
  available_from: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: false,
  published_at: "2026-11-03T06:00:00Z",
  ...overrides,
});

const photo = (path: string, position: number, isCover = false, alt: string | null = null) => ({
  storage_path: path,
  alt_text: alt,
  position,
  is_cover: isCover,
});

/** The one call the page makes: rpc("public_property"), which answers a document or null. */
function arrange({
  property = row() as unknown,
  photos = [] as unknown[],
  label = "prime" as unknown,
  document = undefined as { data: unknown; error: unknown } | undefined,
} = {}) {
  rpc.mockResolvedValue(document ?? { data: { property, photos, label }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T06:00:00Z"));
});

describe("UT-property-queries: one home by its public id", () => {
  it("reads the home, its photos and its label in one call, as an anonymous visitor", async () => {
    arrange({ photos: [photo("a/1.webp", 0, true, "Front")] });
    const result = await getProperty("k3x9a2bd");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("public_property", { p_short_id: "k3x9a2bd" });
    expect(result).toMatchObject({
      status: "found",
      readAt: "2026-11-05T06:00:00.000Z",
      property: {
        shortId: "k3x9a2bd",
        title: "3 BHK apartment",
        listingType: "sale",
        bedrooms: 3,
        label: "prime",
        ageDays: 2,
        photos: [{ path: "a/1.webp", alt: "Front" }],
      },
    });
  });

  it("never reads a table: the page cannot list homes, only fetch the one it names", async () => {
    arrange();
    await getProperty("k3x9a2bd");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["public_property"]);
  });

  it("says missing when no approved home has the id", async () => {
    arrange({ document: { data: null, error: null } });
    expect(await getProperty("zzzzzzzz")).toEqual({
      status: "missing",
      readAt: "2026-11-05T06:00:00.000Z",
    });
  });

  it("puts the cover first, then the photos in their order", async () => {
    arrange({
      photos: [photo("b", 1), photo("c", 2), photo("a", 0), photo("cover", 3, true)],
    });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.photos.map((entry) => entry.path)).toEqual([
      "cover",
      "a",
      "b",
      "c",
    ]);
  });

  it("skips a photo that does not fit and says how many, without naming it", async () => {
    arrange({ photos: [photo("a", 0), { storage_path: "", position: "x" }] });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.photos).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 1 });
  });

  it("reads a label this site does not know as no label", async () => {
    arrange({ label: "gold" });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.label).toBeNull();
    arrange({ label: null });
    const none = await getProperty("k3x9a2bd");
    expect(none.status === "found" && none.property.label).toBeNull();
  });

  it("gives no age for a home with no publish date", async () => {
    arrange({ property: row({ published_at: null }) });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.ageDays).toBeNull();
  });

  it("tags the read so an approval or an edit refreshes it, and keeps it for minutes", async () => {
    arrange();
    await getProperty("k3x9a2bd");
    expect(tag).toHaveBeenCalledWith("home-listings", "property:k3x9a2bd");
    expect(life).toHaveBeenCalledWith("minutes");
  });
});

describe("UT-property-queries: a failed read is never 'not found'", () => {
  it("throws, and logs only the error code, when the home cannot be read", async () => {
    arrange({ document: { data: null, error: { code: "57P01", message: "private detail" } } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow("property could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });

  it("throws, not 'missing', when the row does not fit what the page expects", async () => {
    arrange({ property: row({ listing_type: "lease" }) });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow("does not fit");
  });

  it("throws, not 'missing', when the answer is not the document the page expects", async () => {
    arrange({ document: { data: { property: row() }, error: null } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow("does not fit");
  });
});
