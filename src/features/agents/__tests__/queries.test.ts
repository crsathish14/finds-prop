import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("@/server/logger", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logger: { warn, error },
}));

const { AGENT_LISTINGS_MAX, getAgentListings } = await import("../queries");

const home = (shortId: string, overrides: Record<string, unknown> = {}) => ({
  short_id: shortId,
  slug: "3-bhk-apartment-adyar",
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK apartment",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12_500_000,
  locality: "Adyar",
  city: "Chennai",
  label: null,
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
  ...overrides,
});

const project = (slug: string) => ({
  slug,
  name: "Kadal Vista",
  project_status: "new_launch",
  offer_type: null,
  price: 9500,
  price_type: "per_sqft",
  bhk_options: [2, 3],
  locality: "Adyar",
  images: [],
  featured: false,
  builders: { id: "00000000-0000-4000-b000-0000000000e1", name: "Meena Realty" },
});

const AGENT = "00000000-0000-4000-b000-0000000000e1";

beforeEach(() => vi.clearAllMocks());

describe("getAgentListings", () => {
  it("asks for the agent's listings and gives homes and projects the cards can take", async () => {
    rpc.mockResolvedValue({
      data: { homes: [home("k3x9a2bd")], projects: [project("kadal-vista")] },
      error: null,
    });
    const listings = await getAgentListings(AGENT);
    expect(rpc).toHaveBeenCalledWith("agent_listings", { p_id: AGENT });
    expect(listings.homes).toHaveLength(1);
    expect(listings.homes[0]?.ageDays).toEqual(expect.any(Number));
    expect(listings.projects[0]).toMatchObject({
      slug: "kadal-vista",
      developerName: "Meena Realty",
    });
  });

  it("shows at most six of each and skips a row that does not fit", async () => {
    const homes = Array.from({ length: 8 }, (_, index) => home(`k3x9a2b${index}`));
    rpc.mockResolvedValue({
      data: {
        homes: [...homes, { nonsense: true }],
        projects: Array.from({ length: 8 }, (_, index) => project(`p-${index}`)),
      },
      error: null,
    });
    const listings = await getAgentListings(AGENT);
    expect(listings.homes).toHaveLength(AGENT_LISTINGS_MAX);
    expect(listings.projects).toHaveLength(AGENT_LISTINGS_MAX);
    expect(warn).toHaveBeenCalled();
  });

  it("gives no listings, and logs only the code, when the read fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "secret detail" } });
    await expect(getAgentListings(AGENT)).resolves.toEqual({ homes: [], projects: [] });
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "XX000" });
  });
});
