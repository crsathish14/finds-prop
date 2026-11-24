import { beforeEach, describe, expect, it, vi } from "vitest";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const OTHER = "00000000-0000-4000-b000-000000000002";

const db = vi.hoisted(() => ({
  picked: [] as string[],
  list: { data: [] as unknown, error: null as { code: string } | null },
  project: { data: null as unknown, error: null as { code: string } | null },
  logo: { data: null as unknown },
  calls: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/site", () => ({
  getSiteSettings: async () => ({ sponsored_builders: { featured: db.picked, spotlight: [] } }),
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" },
}));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: async (name: string) => {
      db.calls.push(name);
      return name === "live_project_list" ? db.list : db.project;
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => db.logo }) }),
    }),
  }),
}));

const { getFeaturedProject } = await import("../queries");

const row = (slug: string, builder: string, locality = "OMR") => ({
  slug,
  locality,
  builders: { id: builder },
});

const detail = {
  project: {
    slug: "lake",
    name: "Lakeview Residences",
    locality: "Sholinganallur, OMR",
    bhk_options: [2, 3],
    area_min_sqft: 1120,
    area_max_sqft: 1640,
    price: 7_800_000,
    price_type: "basic",
    project_status: "new_launch",
    possession_date: "2027-12-01",
    rera_number: "TN/00/SAMPLE",
    amenities: ["Pool", "Gym", "Park", "Clubhouse"],
    images: ["lake/1.jpg", "lake/2.jpg", "lake/3.jpg", "lake/4.jpg"],
    builders: { id: BUILDER, name: "Sample Homes" },
  },
};

beforeEach(() => {
  db.picked = [BUILDER];
  db.list = { data: [row("lake", BUILDER), row("other", OTHER)], error: null };
  db.project = { data: detail, error: null };
  db.logo = { data: { logo_path: `${BUILDER}/logo-1.webp`, logo_url: null } };
  db.calls = [];
});

describe("UT-featured-project: the Featured card's project (ADR-192)", () => {
  it("reads nothing at all when the admin picked no one", async () => {
    db.picked = [];
    expect(await getFeaturedProject({})).toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("shows a live project of a picked builder, with its details, photos and uploaded logo", async () => {
    const featured = await getFeaturedProject({ cityKey: "chennai", area: "OMR" });
    expect(db.calls).toEqual(["live_project_list", "public_project"]);
    expect(featured).toEqual({
      href: "/projects/lake",
      name: "Lakeview Residences",
      developerName: "Sample Homes",
      developerLogo: `https://abc.supabase.co/storage/v1/object/public/builder-logos/${BUILDER}/logo-1.webp`,
      locality: "Sholinganallur, OMR",
      bedrooms: [2, 3],
      areaMinSqft: 1120,
      areaMaxSqft: 1640,
      priceRupees: 7_800_000,
      priceType: "basic",
      status: "new_launch",
      possession: "2027-12-01",
      rera: true,
      highlights: ["Pool", "Gym", "Park"],
      photos: [
        "https://abc.supabase.co/storage/v1/object/public/project-media/lake/1.jpg",
        "https://abc.supabase.co/storage/v1/object/public/project-media/lake/2.jpg",
        "https://abc.supabase.co/storage/v1/object/public/project-media/lake/3.jpg",
      ],
      photoCount: 4,
    });
  });

  it("shows nothing when none of the picked has a live project", async () => {
    db.list = { data: [row("other", OTHER)], error: null };
    expect(await getFeaturedProject({})).toBeNull();
    expect(db.calls).toEqual(["live_project_list"]);
  });

  it("never breaks the page: a failed read, or a project that does not fit, shows nothing", async () => {
    db.list = { data: [], error: { code: "42501" } };
    expect(await getFeaturedProject({})).toBeNull();
    db.list = { data: [row("lake", BUILDER)], error: null };
    db.project = { data: null, error: { code: "XX000" } };
    expect(await getFeaturedProject({})).toBeNull();
    db.project = { data: { nothing: true }, error: null };
    expect(await getFeaturedProject({})).toBeNull();
  });

  it("falls back to the logo link, and to no logo", async () => {
    db.logo = { data: { logo_path: null, logo_url: "https://example.test/logo.png" } };
    expect((await getFeaturedProject({}))?.developerLogo).toBe("https://example.test/logo.png");
    db.logo = { data: null };
    expect((await getFeaturedProject({}))?.developerLogo).toBeNull();
  });
});
