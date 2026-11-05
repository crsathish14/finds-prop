import { beforeEach, describe, expect, it, vi } from "vitest";

const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));
vi.mock("@/features/search", () => ({ LISTINGS_TAG: "home-listings", SEARCH_PATH: "/properties" }));
vi.mock("@/features/projects", () => ({
  PROJECTS_TAG: "projects",
  PROJECTS_PATH: "/projects",
  projectPath: (slug: string) => `/projects/${slug}`,
}));
vi.mock("@/features/property", () => ({
  propertyPath: (slug: string, shortId: string) => `/properties/${slug}-${shortId}`,
}));

const { getSitemapSources } = await import("../queries");
const { SITEMAP_MAX_URLS } = await import("../entries");

type Result = { data: unknown; error: { code: string } | null };

/** A query builder that remembers its calls; each `range` answers with the next result in line. */
function table(results: Result[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  let next = 0;
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order"]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  // Like the database, never answer with more rows than the range asked for.
  query.range = (...args: unknown[]) => {
    calls.push({ method: "range", args });
    const [start, end] = args as [number, number];
    const result = results[next++] ?? { data: [], error: null };
    const rows = Array.isArray(result.data) ? result.data.slice(0, end - start + 1) : result.data;
    return Promise.resolve({ ...result, data: rows });
  };
  return { query, calls };
}

const homeRows = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    slug: "home",
    short_id: String(start + index).padStart(8, "0"),
    updated_at: "2026-11-02T10:30:00+00:00",
  }));
const projectRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    slug: `project-${index}`,
    updated_at: "2026-11-03T08:00:00+00:00",
    builders: { id: "b1" },
  }));

beforeEach(() => {
  vi.clearAllMocks();
});

function arrange(projects: Result[], homes: Result[]) {
  const projectTable = table(projects);
  const homeTable = table(homes);
  from.mockImplementation((name: string) =>
    name === "projects" ? projectTable.query : homeTable.query,
  );
  return { projectTable, homeTable };
}

describe("UT-sitemap-queries: reading what the sitemap lists", () => {
  it("reads live projects and approved homes as an anonymous visitor, with only the granted columns", async () => {
    const { projectTable, homeTable } = arrange(
      [{ data: projectRows(2), error: null }],
      [{ data: homeRows(3), error: null }],
    );
    const sources = await getSitemapSources();
    expect(sources.projects).toEqual([
      { slug: "project-0", updatedAt: "2026-11-03T08:00:00+00:00" },
      { slug: "project-1", updatedAt: "2026-11-03T08:00:00+00:00" },
    ]);
    expect(sources.homes).toHaveLength(3);
    expect(sources.homes[0]).toEqual({
      slug: "home",
      shortId: "00000000",
      updatedAt: "2026-11-02T10:30:00+00:00",
    });
    expect(from).toHaveBeenCalledWith("properties");
    expect(from).toHaveBeenCalledWith("projects");
    const selected = [...projectTable.calls, ...homeTable.calls]
      .filter((call) => call.method === "select")
      .map((call) => String(call.args[0]));
    expect(selected).toEqual([
      "slug, updated_at, builders!inner(id)",
      "slug, short_id, updated_at",
    ]);
    for (const private_ of ["owner_id", "address", "location", "status", "phone"]) {
      expect(selected.join(","), private_).not.toMatch(new RegExp(`\\b${private_}\\b`));
    }
  });

  it("pages through a thousand rows at a time until a short page ends the list", async () => {
    const { homeTable } = arrange(
      [{ data: [], error: null }],
      [
        { data: homeRows(1000), error: null },
        { data: homeRows(1000, 1000), error: null },
        { data: homeRows(250, 2000), error: null },
      ],
    );
    const sources = await getSitemapSources();
    expect(sources.homes).toHaveLength(2250);
    const ranges = homeTable.calls
      .filter((call) => call.method === "range")
      .map((call) => call.args);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("is cached for minutes under the homes tag and the projects tag", async () => {
    arrange([{ data: [], error: null }], [{ data: [], error: null }]);
    await getSitemapSources();
    expect(tag).toHaveBeenCalledWith("home-listings");
    expect(tag).toHaveBeenCalledWith("projects");
    expect(life).toHaveBeenCalledWith("minutes");
  });

  it("throws, never lists part of the site, when homes cannot be read", async () => {
    arrange([{ data: [], error: null }], [{ data: null, error: { code: "57P01" } }]);
    await expect(getSitemapSources()).rejects.toThrow("sitemap homes could not be read");
    expect(error).toHaveBeenCalledWith("sitemap homes could not be read", { errorCode: "57P01" });
  });

  it("throws when projects cannot be read", async () => {
    arrange([{ data: null, error: { code: "57P01" } }], [{ data: [], error: null }]);
    await expect(getSitemapSources()).rejects.toThrow("sitemap projects could not be read");
  });

  it("throws on a row that does not fit, rather than listing a broken address", async () => {
    arrange([{ data: [], error: null }], [{ data: [{ slug: "home" }], error: null }]);
    await expect(getSitemapSources()).rejects.toThrow("do not fit");
  });

  it("asks for no more homes than the cap leaves room for, and says when the cap is reached", async () => {
    const { homeTable } = arrange(
      [{ data: projectRows(3), error: null }],
      Array.from({ length: 45 }, (_, page) => ({ data: homeRows(1000, page * 1000), error: null })),
    );
    const sources = await getSitemapSources();
    expect(sources.homes.length).toBe(SITEMAP_MAX_URLS - 3 - 3);
    const last = homeTable.calls.filter((call) => call.method === "range").at(-1)?.args;
    expect(last?.[1]).toBe(SITEMAP_MAX_URLS - 3 - 3 - 1);
    expect(warn).toHaveBeenCalledWith("sitemap reached its address cap", {
      cap: SITEMAP_MAX_URLS - 3 - 3,
    });
  });
});
