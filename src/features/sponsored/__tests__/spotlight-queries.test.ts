import { beforeEach, describe, expect, it, vi } from "vitest";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const OTHER = "00000000-0000-4000-b000-000000000002";

const db = vi.hoisted(() => ({
  picked: [] as string[],
  rows: { data: [] as unknown, error: null as { code: string } | null },
  projects: {} as Record<string, unknown>,
  builder: { data: null as unknown, error: null as { code: string } | null },
  calls: [] as string[],
  tags: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheTag: (tag: string) => db.tags.push(tag),
  cacheLife: () => undefined,
}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/features/site", () => ({
  getSiteSettings: async () => ({ sponsored_builders: { featured: [], spotlight: db.picked } }),
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" },
}));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({
    rpc: async (name: string, args: { p_slug?: string; p_city?: string }) => {
      db.calls.push(args.p_slug ? `${name}:${args.p_slug}` : `${name}:${args.p_city ?? "all"}`);
      if (name === "home_developers") return db.rows;
      const found = db.projects[args.p_slug ?? ""];
      return found ? { data: found, error: null } : { data: null, error: { code: "P0002" } };
    },
    from: (table: string) => {
      db.calls.push(`from:${table}`);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => db.builder }) }) };
    },
  }),
}));

const { getSpotlight } = await import("../spotlight-queries");

const row = (slug: string, builder: string) => ({
  slug,
  name: slug,
  builder_id: builder,
  images: [],
  builders: { id: builder, name: "x", description: null },
});

const project = (slug: string, status: string, images: string[] = [`${slug}/1.jpg`]) => ({
  project: {
    slug,
    name: `Project ${slug}`,
    locality: "OMR",
    bhk_options: [2, 3],
    price: 7_800_000,
    price_type: "basic",
    project_status: status,
    images,
  },
});

beforeEach(() => {
  db.picked = [BUILDER];
  db.rows = {
    data: [
      row("lake", BUILDER),
      row("other", OTHER),
      row("sea", BUILDER),
      row("town", BUILDER),
      row("hill", BUILDER),
    ],
    error: null,
  };
  db.projects = {
    lake: project("lake", "new_launch"),
    sea: project("sea", "ready_to_move", []),
    town: project("town", "new_launch"),
    hill: project("hill", "under_construction"),
  };
  db.builder = {
    data: {
      name: "Sample Homes",
      description: "A long description of the builder.",
      website: "https://sample.example",
      logo_url: "https://elsewhere.example/logo.png",
      logo_path: `${BUILDER}/logo-1.webp`,
      tagline: "Homes by the lake",
      established_year: 2001,
      projects_delivered: 42,
    },
    error: null,
  };
  db.calls = [];
  db.tags = [];
});

describe("UT-spotlight-reader: the Developer spotlight's developer (ADR-193)", () => {
  it("reads nothing at all when the admin picked no one", async () => {
    db.picked = [];
    expect(await getSpotlight("chennai")).toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("draws the picked developer from what they uploaded, with three live projects", async () => {
    const spotlight = await getSpotlight("chennai");
    expect(db.calls.slice(0, 2)).toEqual(["home_developers:chennai", "from:builders"]);
    expect(db.tags).toEqual(["home-projects", "home-projects"]);
    expect(spotlight).toMatchObject({
      name: "Sample Homes",
      logo: `https://abc.supabase.co/storage/v1/object/public/builder-logos/${BUILDER}/logo-1.webp`,
      about: "Homes by the lake",
      delivered: 42,
      listed: 4,
      launching: 2,
      website: "https://sample.example",
    });
    expect(spotlight?.years).toBe(new Date().getFullYear() - 2001);
    expect(spotlight?.projects).toHaveLength(3);
    expect(spotlight?.projects[0]).toEqual({
      href: "/projects/lake",
      name: "Project lake",
      locality: "OMR",
      bedrooms: [2, 3],
      priceRupees: 7_800_000,
      priceType: "basic",
      status: "new_launch",
      cover: "https://abc.supabase.co/storage/v1/object/public/project-media/lake/1.jpg",
    });
    expect(spotlight?.projects[1]?.cover).toBeNull();
  });

  it("falls back to the logo link and the description, and links only a web address", async () => {
    db.builder = {
      data: {
        ...(db.builder.data as object),
        logo_path: null,
        tagline: null,
        website: "sample.example",
        established_year: null,
        projects_delivered: null,
      },
      error: null,
    };
    const spotlight = await getSpotlight();
    expect(db.calls[0]).toBe("home_developers:all");
    expect(spotlight).toMatchObject({
      logo: "https://elsewhere.example/logo.png",
      about: "A long description of the builder.",
      website: null,
      years: null,
      delivered: null,
    });
  });

  it("leaves out a project that cannot be read", async () => {
    delete db.projects.lake;
    const spotlight = await getSpotlight("chennai");
    expect(spotlight?.projects.map((entry) => entry.href)).toEqual([
      "/projects/sea",
      "/projects/town",
      "/projects/hill",
    ]);
    expect(spotlight?.listed).toBe(4);
    expect(spotlight?.launching).toBe(1);
  });

  it("shows nobody when the picked builders have nothing live, or a read fails", async () => {
    db.rows = { data: [row("other", OTHER)], error: null };
    expect(await getSpotlight("chennai")).toBeNull();
    expect(db.calls).toEqual(["home_developers:chennai"]);

    db.rows = { data: null, error: { code: "57014" } };
    expect(await getSpotlight("chennai")).toBeNull();

    db.rows = { data: [row("lake", BUILDER)], error: null };
    db.builder = { data: null, error: { code: "42501" } };
    expect(await getSpotlight("chennai")).toBeNull();

    db.builder = { data: null, error: null };
    expect(await getSpotlight("chennai")).toBeNull();
  });
});
