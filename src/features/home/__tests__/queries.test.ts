import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc, from }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const {
  FEATURED_COUNT,
  getFeaturedHomes,
  getNewLaunchDevelopers,
  getNewestHomes,
  HOME_LISTINGS_TAG,
  HOME_PROJECTS_TAG,
  NEWEST_COUNT,
} = await import("../queries");

const NOW = new Date("2026-11-04T06:00:00Z");

const home = (overrides: Record<string, unknown> = {}) => ({
  short_id: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK apartment",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12_500_000,
  locality: "Velachery",
  city: "Chennai",
  label: "featured",
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("UT-home-queries: the homes of the homepage", () => {
  it("reads the featured homes through the search function, newest first, six of them", async () => {
    rpc.mockResolvedValue({ data: [home()], error: null });
    const homes = await getFeaturedHomes();
    expect(rpc).toHaveBeenCalledWith("search_properties", {
      p_label: "featured",
      p_sort: "newest",
      p_limit: FEATURED_COUNT,
    });
    expect(FEATURED_COUNT).toBe(6);
    expect(homes).toHaveLength(1);
  });

  it("reads the eight newest homes with no label filter", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getNewestHomes();
    expect(rpc).toHaveBeenCalledWith("search_properties", {
      p_sort: "newest",
      p_limit: NEWEST_COUNT,
    });
    expect(NEWEST_COUNT).toBe(8);
  });

  it("tags the reads so approving a listing can refresh them, and keeps them for minutes", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getFeaturedHomes();
    expect(tag).toHaveBeenCalledWith(HOME_LISTINGS_TAG);
    expect(life).toHaveBeenCalledWith("minutes");
    expect(HOME_LISTINGS_TAG).toBe("home-listings");
  });

  it("gives each home its age in whole days, read inside the cache", async () => {
    rpc.mockResolvedValue({
      data: [
        home({ published_at: "2026-11-01T06:00:00Z" }),
        home({ short_id: "b", published_at: "2026-11-04T05:00:00Z" }),
        home({ short_id: "c", published_at: null }),
        home({ short_id: "d", published_at: "not a date" }),
      ],
      error: null,
    });
    const homes = await getNewestHomes();
    expect(homes.map((row) => row.ageDays)).toEqual([3, 0, null, null]);
  });

  it("skips a row that does not fit and logs only how many", async () => {
    rpc.mockResolvedValue({
      data: [home(), home({ listing_type: "lease", title: "private detail" })],
      error: null,
    });
    expect(await getNewestHomes()).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { section: "newest", skipped: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private detail");
  });

  it("leaves the section out and logs only the error code when the read fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57P01", message: "private detail" } });
    expect(await getFeaturedHomes()).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.any(String), {
      errorCode: "57P01",
      section: "featured",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });
});

/** A stand-in for the query builder: every step returns itself and awaiting it gives the result. */
function builder(result: unknown) {
  const steps: Record<string, unknown> = {};
  const self = new Proxy(steps, {
    get(_target, property) {
      if (property === "then") return (resolve: (value: unknown) => void) => resolve(result);
      return (...args: unknown[]) => {
        calls.push([String(property), args]);
        return self;
      };
    },
  });
  return self;
}
let calls: [string, unknown[]][] = [];

const project = (builderId: string, slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  builder_id: builderId,
  images: [`${builderId}/${slug}/a.jpg`],
  builders: { id: builderId, name: `Builder ${builderId}`, description: null },
  ...overrides,
});

describe("UT-home-new-launches: the developers of the homepage", () => {
  beforeEach(() => {
    calls = [];
  });

  it("ranks the builders, then reads the first two projects of each of the first three", async () => {
    from
      .mockReturnValueOnce(
        builder({
          data: [
            { builder_id: "b1" },
            { builder_id: "b2" },
            { builder_id: "b1" },
            { builder_id: "b3" },
            { builder_id: "b4" },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        builder({ data: [project("b1", "p1"), project("b1", "p2")], error: null }),
      )
      .mockReturnValueOnce(builder({ data: [project("b2", "p3")], error: null }))
      .mockReturnValueOnce(builder({ data: [project("b3", "p4")], error: null }));
    const developers = await getNewLaunchDevelopers();
    expect(from).toHaveBeenCalledTimes(4);
    expect(from).toHaveBeenCalledWith("projects");
    expect(developers.map((developer) => [developer.builderId, developer.projectCount])).toEqual([
      ["b1", 2],
      ["b2", 1],
      ["b3", 1],
    ]);
    expect(developers[0]?.projects).toHaveLength(2);
    expect(tag).toHaveBeenCalledWith(HOME_PROJECTS_TAG);
  });

  it("asks for featured projects first, then the newest, and only two of each builder", async () => {
    from
      .mockReturnValueOnce(builder({ data: [{ builder_id: "b1" }], error: null }))
      .mockReturnValueOnce(builder({ data: [project("b1", "p1")], error: null }));
    await getNewLaunchDevelopers();
    const names = calls.map(([name]) => name);
    expect(names).toContain("eq");
    expect(calls.filter(([name]) => name === "order").map(([, args]) => args[0])).toEqual([
      "featured",
      "created_at",
      "featured",
      "created_at",
    ]);
    expect(calls.filter(([name]) => name === "limit").map(([, args]) => args[0])).toEqual([
      1000, 2,
    ]);
  });

  it("leaves out a developer whose read fails, and keeps the others", async () => {
    from
      .mockReturnValueOnce(
        builder({ data: [{ builder_id: "b1" }, { builder_id: "b2" }], error: null }),
      )
      .mockReturnValueOnce(
        builder({ data: null, error: { code: "42501", message: "private detail" } }),
      )
      .mockReturnValueOnce(builder({ data: [project("b2", "p2")], error: null }));
    const developers = await getNewLaunchDevelopers();
    expect(developers.map((developer) => developer.builderId)).toEqual(["b2"]);
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "42501" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });

  it("leaves the section out when the ranking read fails", async () => {
    from.mockReturnValueOnce(builder({ data: null, error: { code: "57P01", message: "x" } }));
    expect(await getNewLaunchDevelopers()).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
  });

  it("gives nothing when there are no public projects", async () => {
    from.mockReturnValueOnce(builder({ data: [], error: null }));
    expect(await getNewLaunchDevelopers()).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
