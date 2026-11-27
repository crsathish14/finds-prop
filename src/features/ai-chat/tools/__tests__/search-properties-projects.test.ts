import { beforeEach, describe, expect, it, vi } from "vitest";
import { listingRow, projectListItem, READ_AT, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-one-list (ADR-215): a home search lists the matching projects in the same ranked list, for a signed-in
// customer. The reads are stand-ins; the homes and projects are made up.

const getSearchResults = vi.fn();
const getProjects = vi.fn();
const getPromotionLists = vi.fn();
const getProjectExtras = vi.fn();

const NO_PROMOTIONS = {
  sponsoredBuilders: new Set<string>(),
  sponsoredProjects: new Set<string>(),
  spotlightBuilders: new Set<string>(),
  topBuilders: new Set<string>(),
};

vi.mock("../../ranking/reads.server", () => ({
  getPromotionLists,
  getProjectExtras,
  getPrimeRules: vi.fn(async () => ({
    ratePerSqft: null,
    totalPrice: null,
    rentPerMonth: null,
    rentPerSqftMonth: null,
  })),
  getHomeExtras: vi.fn(async () => new Map()),
}));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/projects", async () => {
  const { bhkSizes, priceOf } = await import("@/features/projects/view");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  return {
    getProjects,
    bhkSizes,
    priceOf,
    OFFER_TYPES,
    PRICE_TYPES,
    PROJECT_STATUSES,
    PROJECT_LIST_LIMIT: 60,
  };
});
vi.mock("@/features/search", async () => {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults,
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
});

const { runTool } = await import("../run");
const { searchPropertiesTool } = await import("../search-properties");
const { comparablePrice } = await import("../listing-projects");
const { createTurnMemory } = await import("../../state/memory");

const NOTHING = {
  listingType: null,
  propertyType: null,
  bhk: null,
  minPrice: null,
  maxPrice: null,
  city: null,
  locality: null,
  keyword: null,
  label: null,
  preferLocalities: null,
  preferAmenities: null,
  preferFurnishing: null,
  sort: null,
  page: null,
};

const kind = (projectType: string, propertyType: string) => ({
  amenities: [],
  createdAt: null,
  areaMinSqft: null,
  projectType,
  propertyType,
});

const PROJECTS = [
  projectListItem({
    slug: "kadal-sale",
    locality: "Velachery",
    offerType: null,
    price: 6_500_000,
    priceType: "basic",
    bhkOptions: [2, 3],
    builderId: "b-paid",
  }),
  projectListItem({
    slug: "kadal-rent",
    locality: "Velachery",
    offerType: "rent",
    price: 28_000,
    priceType: "rent_per_month",
    bhkOptions: [2],
    builderId: "b-other",
  }),
  projectListItem({
    slug: "office-park",
    locality: "Velachery",
    offerType: "sale",
    price: 9_000_000,
    priceType: "basic",
    bhkOptions: [],
    builderId: "b-other",
  }),
];

const EXTRAS = new Map([
  ["kadal-sale", kind("residential", "apartment")],
  ["kadal-rent", kind("residential", "apartment")],
  ["office-park", kind("commercial", "office")],
]);

const search = (input: Record<string, unknown>, context = TOOL_CONTEXT) =>
  runTool([searchPropertiesTool], { name: "search_properties", input }, context);

beforeEach(() => {
  vi.clearAllMocks();
  getSearchResults.mockResolvedValue({
    status: "ok",
    homes: [
      listingRow({
        short_id: "home0001",
        listing_type: "sale",
        price: 6_000_000,
        locality: "Velachery",
      }),
    ],
    total: 1,
    readAt: READ_AT,
  });
  getProjects.mockResolvedValue({ status: "ok", projects: PROJECTS, readAt: READ_AT });
  getPromotionLists.mockResolvedValue(NO_PROMOTIONS);
  getProjectExtras.mockImplementation(
    async (slugs: string[]) => new Map([...EXTRAS].filter(([slug]) => slugs.includes(slug))),
  );
});

describe("UT-ai-tool-one-list: homes and projects in one list (ADR-215)", () => {
  it("lists the residential projects for sale with homes to buy, and counts them in the total", async () => {
    const result = await search({ ...NOTHING, listingType: "sale", locality: "Velachery" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const output = result.output as {
      total: number;
      projects: { slug: string }[];
      order: string[];
    };
    expect(output.projects.map((project) => project.slug)).toEqual(["kadal-sale"]);
    expect(output.total).toBe(2);
    expect(output.order).toHaveLength(2);
    expect(output.order).toContain("project:kadal-sale");
    expect(output.order).toContain("home:home0001");
    expect(result.references.map((reference) => reference.kind).sort()).toEqual([
      "home",
      "project",
    ]);
  });

  it("lists projects for rent with homes to rent, by the monthly rent", async () => {
    const result = await search({ ...NOTHING, listingType: "rent", maxPrice: 30_000 });
    if (result.status !== "ok") throw new Error("the search failed");
    const output = result.output as { projects: { slug: string }[] };
    expect(output.projects.map((project) => project.slug)).toEqual(["kadal-rent"]);
  });

  it("reads commercial projects only for a commercial search", async () => {
    const homes = await search({ ...NOTHING, listingType: "sale" });
    const commercial = await search({
      ...NOTHING,
      listingType: "sale",
      propertyType: "commercial",
    });
    if (homes.status !== "ok" || commercial.status !== "ok") throw new Error("the search failed");
    expect(
      (homes.output as { projects: { slug: string }[] }).projects.map((project) => project.slug),
    ).not.toContain("office-park");
    expect(
      (commercial.output as { projects: { slug: string }[] }).projects.map(
        (project) => project.slug,
      ),
    ).toEqual(["office-park"]);
  });

  it("puts a promoted project first among the good matches", async () => {
    getPromotionLists.mockResolvedValue({
      ...NO_PROMOTIONS,
      sponsoredBuilders: new Set(["b-paid"]),
    });
    const result = await search({ ...NOTHING, listingType: "sale", locality: "Velachery" });
    if (result.status !== "ok") throw new Error("the search failed");
    expect((result.output as { order: string[] }).order[0]).toBe("project:kadal-sale");
  });

  it("lists homes only for a guest, for an order the customer asked for, and for a home label", async () => {
    for (const [input, context] of [
      [
        { ...NOTHING, listingType: "sale" },
        { ...TOOL_CONTEXT, signedIn: false },
      ],
      [{ ...NOTHING, listingType: "sale", sort: "price_asc" }, TOOL_CONTEXT],
      [{ ...NOTHING, listingType: "sale", label: "prime" }, TOOL_CONTEXT],
    ] as const) {
      const result = await search(input, context);
      if (result.status !== "ok") throw new Error("the search failed");
      expect((result.output as { projects: unknown[] }).projects).toEqual([]);
    }
    expect(getProjects).not.toHaveBeenCalled();
  });

  it("still answers with the homes when the projects cannot be read", async () => {
    getProjects.mockRejectedValue(new Error("down"));
    const result = await search({ ...NOTHING, listingType: "sale" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect((result.output as { projects: unknown[]; total: number }).projects).toEqual([]);
    expect((result.output as { total: number }).total).toBe(1);
  });

  it("pages through the one list without repeating a project, and remembers it as a project", async () => {
    const memory = createTurnMemory(null);
    const context = { ...TOOL_CONTEXT, search: memory };
    await search({ ...NOTHING, listingType: "sale", locality: "Velachery" }, context);
    expect(memory.next().seen).toContain("project:kadal-sale");
    expect(memory.next().seen).toContain("home:home0001");
    const next = await search(
      { ...NOTHING, listingType: "sale", locality: "Velachery", page: "next" },
      context,
    );
    if (next.status !== "ok") throw new Error("the search failed");
    expect((next.output as { order: string[] }).order).toEqual([]);
  });
});

describe("UT-ai-tool-one-list: the price a project compares by", () => {
  it("is the monthly rent for rent, a total for sale, and none for a rate", () => {
    expect(comparablePrice(PROJECTS[1] ?? projectListItem())).toBe(28_000);
    expect(comparablePrice(PROJECTS[0] ?? projectListItem())).toBe(6_500_000);
    expect(comparablePrice(projectListItem({ price: 8_500, priceType: "per_sqft" }))).toBeNull();
    expect(
      comparablePrice(
        projectListItem({ offerType: "rent", price: 80, priceType: "rent_per_sqft_month" }),
      ),
    ).toBeNull();
  });
});

describe("UT-ai-tool-one-list: which promoted projects carry Featured in the chat", () => {
  it("is the paid lists and the moderation switch, not the Top developers page or none", async () => {
    const { carriesFeatured } = await import("../../ranking/promotions");
    expect(carriesFeatured("sponsored")).toBe(true);
    expect(carriesFeatured("featured")).toBe(true);
    expect(carriesFeatured("spotlight")).toBe(true);
    expect(carriesFeatured("top")).toBe(false);
    expect(carriesFeatured("none")).toBe(false);
  });
});
