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
  it("reads the featured homes through the home function, which fixes the size at six", async () => {
    rpc.mockResolvedValue({ data: [home()], error: null });
    const homes = await getFeaturedHomes();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("home_properties", { p_kind: "featured" });
    expect(FEATURED_COUNT).toBe(6);
    expect(homes).toHaveLength(1);
  });

  it("reads the newest homes through the home function, which fixes the size at eight", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getNewestHomes();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("home_properties", { p_kind: "newest" });
    expect(NEWEST_COUNT).toBe(8);
  });

  it("keeps only the chosen city when one is given, for both sections", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getFeaturedHomes("coimbatore");
    await getNewestHomes("coimbatore");
    expect(rpc).toHaveBeenNthCalledWith(1, "home_properties", {
      p_kind: "featured",
      p_city: "coimbatore",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "home_properties", {
      p_kind: "newest",
      p_city: "coimbatore",
    });
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

const project = (builderId: string, slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  builder_id: builderId,
  images: [`${builderId}/${slug}/a.jpg`],
  builders: { id: builderId, name: `Builder ${builderId}`, description: null },
  ...overrides,
});

describe("UT-home-new-launches: the developers of the homepage", () => {
  it("reads once, ranks the builders, then gives the first two projects of each of the first three", async () => {
    rpc.mockResolvedValue({
      data: [
        project("b1", "p1"),
        project("b2", "p3"),
        project("b1", "p2"),
        project("b3", "p4"),
        project("b4", "p5"),
        project("b1", "p6"),
      ],
      error: null,
    });
    const developers = await getNewLaunchDevelopers();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("home_developers", {});
    expect(developers.map((developer) => [developer.builderId, developer.projectCount])).toEqual([
      ["b1", 3],
      ["b2", 1],
      ["b3", 1],
    ]);
    expect(developers[0]?.projects.map((entry) => entry.slug)).toEqual(["p1", "p2"]);
    expect(tag).toHaveBeenCalledWith(HOME_PROJECTS_TAG);
  });

  it("limits the developers to the chosen city when one is given", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getNewLaunchDevelopers([], "madurai");
    expect(rpc).toHaveBeenCalledWith("home_developers", { p_city: "madurai" });
  });

  it("reads through the function only, never a table", async () => {
    rpc.mockResolvedValue({ data: [project("b1", "p1")], error: null });
    await getNewLaunchDevelopers();
    expect(from).not.toHaveBeenCalled();
  });

  it("leaves out a developer whose projects do not fit, and keeps the others", async () => {
    rpc.mockResolvedValue({
      data: [project("b1", "p1", { name: "" }), project("b2", "p2")],
      error: null,
    });
    const developers = await getNewLaunchDevelopers();
    expect(developers.map((developer) => developer.builderId)).toEqual(["b2"]);
  });

  it("leaves the section out and logs only the error code when the read fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57P01", message: "private detail" } });
    expect(await getNewLaunchDevelopers()).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57P01" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });

  it("gives nothing when there are no public projects", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getNewLaunchDevelopers()).toEqual([]);
  });
});

describe("UT-home-new-launches: the super admin's choice of developers", () => {
  it("shows the chosen developers in the chosen order, from the same single read", async () => {
    rpc.mockResolvedValue({
      data: [project("b1", "p1"), project("b2", "p2"), project("b3", "p3")],
      error: null,
    });
    const developers = await getNewLaunchDevelopers(["b3", "b1", "nobody"]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(developers.map((developer) => developer.builderId)).toEqual(["b3", "b1"]);
  });
});
