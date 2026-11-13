import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const order = vi.fn();
const rpc = vi.fn();
const eqProperty = vi.fn();
const eqMedia = vi.fn();
const select = vi.fn();
const from = vi.fn();
const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from, rpc }) }));
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

/** The chain the page uses: from("properties").select().eq().maybeSingle(), from("listing_media")... */
function arrange({
  property = { data: row(), error: null } as { data: unknown; error: unknown },
  media = { data: [] as unknown[], error: null } as { data: unknown; error: unknown },
  label = { data: "prime", error: null } as { data: unknown; error: unknown },
} = {}) {
  maybeSingle.mockResolvedValue(property);
  order.mockResolvedValue(media);
  rpc.mockResolvedValue(label);
  eqProperty.mockReturnValue({ maybeSingle });
  eqMedia.mockReturnValue({ order });
  from.mockImplementation((table: string) => ({
    select: (columns: string) => {
      select(columns);
      return { eq: table === "properties" ? eqProperty : eqMedia };
    },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T06:00:00Z"));
});

describe("UT-property-queries: one home by its public id", () => {
  it("reads the home, its photos and its label as an anonymous visitor", async () => {
    arrange({ media: { data: [photo("a/1.webp", 0, true, "Front")], error: null } });
    const result = await getProperty("k3x9a2bd");
    expect(from).toHaveBeenCalledWith("properties");
    expect(from).toHaveBeenCalledWith("listing_media");
    expect(eqProperty).toHaveBeenCalledWith("short_id", "k3x9a2bd");
    expect(eqMedia).toHaveBeenCalledWith("listing_id", "00000000-0000-4000-8000-000000000001");
    expect(rpc).toHaveBeenCalledWith("listing_label", {
      listing_price: 12_500_000,
      listing_kind: "sale",
      is_featured: false,
    });
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

  it("asks only for the columns a visitor may read: no owner, address or exact location", async () => {
    arrange();
    await getProperty("k3x9a2bd");
    const columns = select.mock.calls.map((call) => String(call[0])).join(",");
    for (const private_ of ["owner_id", "address", "pincode", "location", "status", "rejection"]) {
      expect(columns, private_).not.toMatch(new RegExp(`\\b${private_}\\b`));
    }
  });

  it("says missing, without reading photos, when no approved home has the id", async () => {
    arrange({ property: { data: null, error: null } });
    expect(await getProperty("zzzzzzzz")).toEqual({
      status: "missing",
      readAt: "2026-11-05T06:00:00.000Z",
    });
    expect(from).not.toHaveBeenCalledWith("listing_media");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("puts the cover first, then the photos in their order", async () => {
    arrange({
      media: {
        data: [photo("b", 1), photo("c", 2), photo("a", 0), photo("cover", 3, true)],
        error: null,
      },
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
    arrange({ media: { data: [photo("a", 0), { storage_path: "", position: "x" }], error: null } });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.photos).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 1 });
  });

  it("reads a label this site does not know as no label", async () => {
    arrange({ label: { data: "gold", error: null } });
    const result = await getProperty("k3x9a2bd");
    expect(result.status === "found" && result.property.label).toBeNull();
    arrange({ label: { data: null, error: null } });
    const none = await getProperty("k3x9a2bd");
    expect(none.status === "found" && none.property.label).toBeNull();
  });

  it("gives no age for a home with no publish date", async () => {
    arrange({ property: { data: row({ published_at: null }), error: null } });
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
    arrange({ property: { data: null, error: { code: "57P01", message: "private detail" } } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow("property could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });

  it("throws when the photos cannot be read", async () => {
    arrange({ media: { data: null, error: { code: "42501", message: "x" } } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow();
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "42501" });
  });

  it("throws when the label cannot be read", async () => {
    arrange({ label: { data: null, error: { code: "42883", message: "x" } } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow();
  });

  it("throws, not 'missing', when the row does not fit what the page expects", async () => {
    arrange({ property: { data: row({ listing_type: "lease" }), error: null } });
    await expect(getProperty("k3x9a2bd")).rejects.toThrow("does not fit");
  });
});
