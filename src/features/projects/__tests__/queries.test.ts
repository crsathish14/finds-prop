import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (thrown: unknown) => {
    if (thrown instanceof Error && thrown.message === "NEXT_REDIRECT") throw thrown;
  },
}));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const { getProject, getProjects, PROJECT_LIST_LIMIT, PROJECTS_TAG } = await import("../queries");

type Result = { data: unknown; error: { code: string } | null; count?: number | null };

/**
 * A query builder that remembers every call made on it and can be awaited, or ended with
 * `maybeSingle()`, like the one the Supabase client gives.
 */
function builder(result: Result) {
  const calls: { method: string; args: unknown[] }[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  query.maybeSingle = () => Promise.resolve(result);
  query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { query, calls };
}

const listRow = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  project_status: "under_construction",
  price_min: 7_800_000,
  price_max: 14_200_000,
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
  price_min: 7_800_000,
  price_max: 14_200_000,
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
  project?: Result;
  units?: Result;
  available?: Result;
  trend?: Result;
};

/** Hands out the builders the page asks for, by table and by what it selects. */
function arrange({ project, units, available, trend }: Parts = {}) {
  const made = {
    project: builder(project ?? { data: projectRow(), error: null }),
    units: builder(units ?? { data: [unitRow("A-2", 1)], error: null, count: 1 }),
    available: builder(available ?? { data: null, error: null, count: 1 }),
    trend: builder(trend ?? { data: [], error: null }),
  };
  let unitsAsked = false;
  from.mockImplementation((table: string) => {
    if (table === "projects") return made.project.query;
    if (table === "project_price_trends") return made.trend.query;
    if (table !== "project_units") return undefined;
    // The first call asks for the rows, the second for the count of available ones.
    if (unitsAsked) return made.available.query;
    unitsAsked = true;
    return made.units.query;
  });
  return made;
}

const NOW = new Date("2026-11-13T10:12:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("UT-project-queries: the list of projects", () => {
  it("reads the public columns as a visitor, featured first and then newest, with a limit", async () => {
    const list = builder({ data: [listRow()], error: null });
    from.mockReturnValue(list.query);
    const result = await getProjects();
    expect(from).toHaveBeenCalledWith("projects");
    const methods = list.calls.map((call) => call.method);
    expect(methods).toEqual(["select", "order", "order", "limit"]);
    expect(list.calls[0]?.args[0]).toContain("builders!inner(id, name)");
    expect(list.calls[0]?.args[0]).not.toMatch(/moderation|form_id|published|rejection/);
    expect(list.calls[1]?.args).toEqual(["featured", { ascending: false }]);
    expect(list.calls[2]?.args).toEqual(["created_at", { ascending: false }]);
    expect(list.calls[3]?.args).toEqual([PROJECT_LIST_LIMIT]);
    expect(tag).toHaveBeenCalledWith(PROJECTS_TAG);
    expect(life).toHaveBeenCalledWith("minutes");
    expect(result).toEqual({
      status: "ok",
      readAt: NOW.toISOString(),
      projects: [
        {
          slug: "kadal-vista",
          name: "Kadal Vista",
          developerName: "Kadal Homes",
          status: "under_construction",
          priceMin: 7_800_000,
          priceMax: 14_200_000,
          bhkOptions: [2, 3],
          locality: "OMR Navalur",
          coverPath: "kadal/1.webp",
          featured: true,
        },
      ],
    });
  });

  it("gives an empty list, not a failure, when there are no projects", async () => {
    from.mockReturnValue(builder({ data: [], error: null }).query);
    expect(await getProjects()).toEqual({ status: "ok", projects: [], readAt: NOW.toISOString() });
  });

  it("has no cover for a project with no pictures", async () => {
    from.mockReturnValue(builder({ data: [listRow({ images: [] })], error: null }).query);
    const result = await getProjects();
    expect(result.status === "ok" && result.projects[0]?.coverPath).toBeNull();
  });

  it("treats a status this site does not know as no status", async () => {
    from.mockReturnValue(
      builder({ data: [listRow({ project_status: "dreaming" })], error: null }).query,
    );
    const result = await getProjects();
    expect(result.status === "ok" && result.projects[0]?.status).toBeNull();
  });

  it("skips a row that does not fit and says how many, without the row", async () => {
    from.mockReturnValue(
      builder({ data: [listRow({ slug: "" }), listRow({ slug: "ok-one" })], error: null }).query,
    );
    const result = await getProjects();
    expect(result.status === "ok" && result.projects.map((project) => project.slug)).toEqual([
      "ok-one",
    ]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 1 });
  });

  it("reports a failed read as failed, logging only the code", async () => {
    from.mockReturnValue(builder({ data: null, error: { code: "PGRST301" } }).query);
    expect(await getProjects()).toEqual({ status: "failed" });
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("lets a redirect or a prerender signal through instead of calling it a failure", async () => {
    from.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    await expect(getProjects()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("UT-project-queries: one project by its slug", () => {
  it("reads the project, its first units, the counts and the trend as a visitor", async () => {
    const made = arrange({
      units: { data: [unitRow("A-10", 1), unitRow("A-2", 1)], error: null, count: 320 },
      available: { data: null, error: null, count: 184 },
      trend: {
        data: [
          { month: "2026-10-01", price_per_sqft: 8350 },
          { month: "2026-09-01", price_per_sqft: 8230 },
        ],
        error: null,
      },
    });
    const result = await getProject("kadal-vista");

    expect(made.project.calls.map((call) => call.method)).toEqual(["select", "eq"]);
    expect(made.project.calls[1]?.args).toEqual(["slug", "kadal-vista"]);
    expect(made.units.calls[0]?.args[1]).toEqual({ count: "exact" });
    expect(made.units.calls.at(-1)).toEqual({ method: "limit", args: [20] });
    expect(made.available.calls[0]?.args[1]).toEqual({ count: "exact", head: true });
    expect(made.available.calls.map((call) => call.args)).toContainEqual(["status", "available"]);
    expect(made.trend.calls.at(-1)).toEqual({ method: "limit", args: [12] });
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
    });
    // The rows are put in the order of the table, and the trend oldest month first.
    expect(result.project.units.map((unit) => unit.number)).toEqual(["A-2", "A-10"]);
    expect(result.project.trend.map((point) => point.month)).toEqual(["2026-09-01", "2026-10-01"]);
    // The time is taken inside the cached read, so it is the time of the last refill (AI-P3-T01).
    expect(result.readAt).toBe(NOW.toISOString());
  });

  it("never asks for the moderation columns, the form link or the exact location", async () => {
    const made = arrange();
    await getProject("kadal-vista");
    const columns = String(made.project.calls[0]?.args[0]);
    for (const hidden of [
      "moderation",
      "published",
      "form_id",
      "latitude",
      "longitude",
      "address",
      "rejection",
    ]) {
      expect(columns).not.toContain(hidden);
    }
  });

  it("is missing when no approved, published project has this slug", async () => {
    arrange({ project: { data: null, error: null } });
    expect(await getProject("nobody-here")).toEqual({
      status: "missing",
      readAt: NOW.toISOString(),
    });
  });

  it("falls back to the rows it holds when the database gives no counts", async () => {
    arrange({
      units: { data: [unitRow("A-1", 1), unitRow("A-2", 1)], error: null, count: null },
      available: { data: null, error: null, count: null },
    });
    const result = await getProject("kadal-vista");
    expect(
      result.status === "found" && [result.project.unitCount, result.project.availableCount],
    ).toEqual([2, 0]);
  });

  it("skips a unit or a month that does not fit, and says so", async () => {
    arrange({
      units: { data: [unitRow("A-1", 1, "mystery"), unitRow("A-2", 1)], error: null, count: 2 },
      trend: { data: [{ month: "March", price_per_sqft: 1 }], error: null },
    });
    const result = await getProject("kadal-vista");
    expect(result.status === "found" && result.project.units.map((unit) => unit.number)).toEqual([
      "A-2",
    ]);
    expect(result.status === "found" && result.project.trend).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 2 });
  });

  it("throws, so it is never cached, when the project cannot be read", async () => {
    arrange({ project: { data: null, error: { code: "PGRST301" } } });
    await expect(getProject("kadal-vista")).rejects.toThrow("project could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("throws, not missing, when the project row does not fit", async () => {
    arrange({ project: { data: projectRow({ name: "" }), error: null } });
    await expect(getProject("kadal-vista")).rejects.toThrow("does not fit");
  });

  it("throws when the units, the count or the trend cannot be read", async () => {
    for (const parts of [
      { units: { data: null, error: { code: "42501" } } },
      { available: { data: null, error: { code: "42501" } } },
      { trend: { data: null, error: { code: "42501" } } },
    ] satisfies Parts[]) {
      arrange(parts);
      await expect(getProject("kadal-vista")).rejects.toThrow("could not be read");
    }
  });
});
