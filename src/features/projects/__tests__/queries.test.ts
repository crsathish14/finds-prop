import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
const listRpc = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (thrown: unknown) => {
    if (thrown instanceof Error && thrown.message === "NEXT_REDIRECT") throw thrown;
  },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc: listRpc }),
}));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from, rpc }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const { getProject, getProjects, PROJECT_LIST_LIMIT, PROJECTS_TAG } = await import("../queries");

const listRow = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  project_status: "under_construction",
  offer_type: null,
  price: 7_800_000,
  price_type: "basic",
  bhk_options: [2, 3],
  locality: "OMR Navalur",
  images: ["kadal/1.webp", "kadal/2.webp"],
  featured: true,
  builders: { id: "b1", name: "Kadal Homes" },
  ...overrides,
});

const projectRow = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kadal-vista",
  name: "Kadal Vista",
  project_status: "under_construction",
  property_type: "apartment",
  offer_type: null,
  price: 7_800_000,
  price_type: "basic",
  area_min_sqft: null,
  area_max_sqft: null,
  bhk_options: [2, 3],
  land_area_acres: 4.2,
  total_units: 320,
  possession_date: "2028-12-31",
  contact_phone: "+914412345678",
  locality: "OMR Navalur",
  advantages: ["Near the beach road"],
  nearby: ["Shopping mall"],
  rera_applicable: true,
  rera_number: "TN/SAMPLE/0000",
  rera_not_applicable_reason: null,
  description: "A gated community.",
  specifications: "Structure: RCC",
  amenities: ["Gym"],
  images: ["kadal/1.webp"],
  floor_plans: ["kadal/plan.webp"],
  videos: ["https://youtu.be/abc"],
  brochure_path: "kadal/brochure.pdf",
  seo_title: null,
  seo_description: null,
  featured: false,
  builders: { id: "b1", name: "Kadal Homes" },
  ...overrides,
});

const unitRow = (number: string, floor: number | null, status = "available") => ({
  unit_number: number,
  floor_number: floor,
  bhk: 2,
  area_sqft: 1050,
  facing: "East",
  price: 7_800_000,
  status,
  floor_plan_path: null,
});

type Parts = {
  project?: unknown;
  units?: unknown[];
  unitCount?: number;
  availableCount?: number;
  trend?: unknown[];
  /** Replaces the whole answer of `public_project()`, for the failures and the missing project. */
  answer?: { data: unknown; error: { code: string } | null };
};

/** The one call the page makes: rpc("public_project"), which answers a document or null. */
function arrange({
  project = projectRow(),
  units = [unitRow("A-2", 1)],
  unitCount = 1,
  availableCount = 1,
  trend = [],
  answer,
}: Parts = {}) {
  rpc.mockResolvedValue(
    answer ?? {
      data: {
        project,
        units,
        unit_count: unitCount,
        available_count: availableCount,
        trend,
      },
      error: null,
    },
  );
}

const NOW = new Date("2026-11-13T10:12:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** The list is read with the signed-in visitor's own session: `live_project_list()`, never a table. */
const answer = (data: unknown, failure: { code: string } | null = null) =>
  listRpc.mockResolvedValue({ data, error: failure });

describe("UT-project-queries: the list of projects", () => {
  it("asks for one city only when a city key is given", async () => {
    answer([]);
    await getProjects("madurai");
    expect(listRpc).toHaveBeenCalledWith("live_project_list", {
      p_limit: PROJECT_LIST_LIMIT,
      p_city: "madurai",
    });
  });

  it("reads the live projects through the sign-in-only function, with a limit", async () => {
    answer([listRow()]);
    const result = await getProjects();
    expect(listRpc).toHaveBeenCalledTimes(1);
    expect(listRpc).toHaveBeenCalledWith("live_project_list", { p_limit: PROJECT_LIST_LIMIT });
    // Nothing shared between visitors: no cache tag, no cache life, no table, no anonymous client.
    expect(tag).not.toHaveBeenCalled();
    expect(life).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "ok",
      readAt: NOW.toISOString(),
      projects: [
        {
          slug: "kadal-vista",
          name: "Kadal Vista",
          developerName: "Kadal Homes",
          status: "under_construction",
          offerType: null,
          price: 7_800_000,
          priceType: "basic",
          bhkOptions: [2, 3],
          locality: "OMR Navalur",
          coverPath: "kadal/1.webp",
          featured: true,
        },
      ],
    });
  });

  it("gives an empty list, not a failure, when there are no projects", async () => {
    answer([]);
    expect(await getProjects()).toEqual({ status: "ok", projects: [], readAt: NOW.toISOString() });
  });

  it("has no cover for a project with no pictures", async () => {
    answer([listRow({ images: [] })]);
    const result = await getProjects();
    expect(result.status === "ok" && result.projects[0]?.coverPath).toBeNull();
  });

  it("treats a status this site does not know as no status", async () => {
    answer([listRow({ project_status: "dreaming" })]);
    const result = await getProjects();
    expect(result.status === "ok" && result.projects[0]?.status).toBeNull();
  });

  it("treats a price type or a sale or rent choice this site does not know as none", async () => {
    answer([listRow({ price_type: "weekly", offer_type: "lease" })]);
    const result = await getProjects();
    expect(result.status === "ok" && result.projects[0]).toMatchObject({
      price: 7_800_000,
      priceType: null,
      offerType: null,
    });
  });

  it("skips a row that does not fit and says how many, without the row", async () => {
    answer([listRow({ slug: "" }), listRow({ slug: "ok-one" })]);
    const result = await getProjects();
    expect(result.status === "ok" && result.projects.map((project) => project.slug)).toEqual([
      "ok-one",
    ]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 1 });
  });

  it("reports a failed read as failed, logging only the code", async () => {
    answer(null, { code: "PGRST301" });
    expect(await getProjects()).toEqual({ status: "failed" });
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("lets a redirect or a prerender signal through instead of calling it a failure", async () => {
    listRpc.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    await expect(getProjects()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("UT-project-queries: one project by its slug", () => {
  it("reads the project, its first units, the counts and the trend in one call, as a visitor", async () => {
    arrange({
      units: [unitRow("A-10", 1), unitRow("A-2", 1)],
      unitCount: 320,
      availableCount: 184,
      trend: [
        { month: "2026-10-01", price_per_sqft: 8350 },
        { month: "2026-09-01", price_per_sqft: 8230 },
      ],
    });
    const result = await getProject("kadal-vista");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("public_project", { p_slug: "kadal-vista" });
    expect(from).not.toHaveBeenCalled();
    expect(tag).toHaveBeenCalledWith(PROJECTS_TAG, "project:kadal-vista");

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.project).toMatchObject({
      slug: "kadal-vista",
      name: "Kadal Vista",
      developer: { id: "b1", name: "Kadal Homes" },
      unitCount: 320,
      availableCount: 184,
      totalUnits: 320,
      reraNumber: "TN/SAMPLE/0000",
      reraNotApplicableReason: null,
      propertyType: "apartment",
      offerType: null,
      price: 7_800_000,
      priceType: "basic",
      areaMinSqft: null,
      areaMaxSqft: null,
    });
    // The rows are put in the order of the table, and the trend oldest month first.
    expect(result.project.units.map((unit) => unit.number)).toEqual(["A-2", "A-10"]);
    expect(result.project.trend.map((point) => point.month)).toEqual(["2026-09-01", "2026-10-01"]);
    // The time is taken inside the cached read, so it is the time of the last refill (AI-P3-T01).
    expect(result.readAt).toBe(NOW.toISOString());
  });

  it("is missing when no approved, published project has this slug", async () => {
    arrange({ answer: { data: null, error: null } });
    expect(await getProject("nobody-here")).toEqual({
      status: "missing",
      readAt: NOW.toISOString(),
    });
  });

  it("skips a unit or a month that does not fit, and says so", async () => {
    arrange({
      units: [unitRow("A-1", 1, "mystery"), unitRow("A-2", 1)],
      unitCount: 2,
      trend: [{ month: "March", price_per_sqft: 1 }],
    });
    const result = await getProject("kadal-vista");
    expect(result.status === "found" && result.project.units.map((unit) => unit.number)).toEqual([
      "A-2",
    ]);
    expect(result.status === "found" && result.project.trend).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 2 });
  });

  it("throws, so it is never cached, when the project cannot be read", async () => {
    arrange({ answer: { data: null, error: { code: "PGRST301" } } });
    await expect(getProject("kadal-vista")).rejects.toThrow("project could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("throws, not missing, when the project row does not fit", async () => {
    arrange({ project: projectRow({ name: "" }) });
    await expect(getProject("kadal-vista")).rejects.toThrow("does not fit");
  });

  it("throws, not missing, when the answer is not the document the page expects", async () => {
    arrange({ answer: { data: { project: projectRow() }, error: null } });
    await expect(getProject("kadal-vista")).rejects.toThrow("does not fit");
  });
});
