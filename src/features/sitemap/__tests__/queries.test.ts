import { beforeEach, describe, expect, it, vi } from "vitest";

const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));
vi.mock("@/features/search", () => ({ LISTINGS_TAG: "home-listings", SEARCH_PATH: "/properties" }));
vi.mock("@/features/projects", () => ({
  PROJECTS_TAG: "projects",
  PROJECTS_PATH: "/projects",
  projectPath: (slug: string) => `/projects/${slug}`,
}));
const faqState = vi.hoisted(() => ({
  on: true,
  faqs: [] as { updatedAt: string }[],
}));
const blogState = vi.hoisted(() => ({
  on: true,
  posts: [] as { slug: string; updatedAt: string }[],
}));
const careersState = vi.hoisted(() => ({
  on: true,
  jobs: [] as { slug: string; updatedAt: string }[],
}));
vi.mock("@/features/site", () => ({
  getContentModuleOn: async (module: string) =>
    module === "blog" ? blogState.on : module === "careers" ? careersState.on : faqState.on,
}));
vi.mock("@/features/careers", () => ({ getJobSitemapEntries: async () => careersState.jobs }));
vi.mock("@/features/blog", () => ({ getBlogSitemapEntries: async () => blogState.posts }));
vi.mock("@/features/faq", () => ({ getPublicFaqs: async () => faqState.faqs }));
vi.mock("@/features/property", () => ({
  propertyPath: (slug: string, shortId: string) => `/properties/${slug}-${shortId}`,
}));

const { getSitemapBlog, getSitemapCareers, getSitemapFaq, getSitemapSources } =
  await import("../queries");
const { SITEMAP_MAX_URLS } = await import("../entries");

type Result = { data: unknown; error: { code: string } | null };

/**
 * `sitemap_entries()` stand-in: each kind has its own list of answers, one per call. Like the database, it
 * never answers with more rows than the page asked for.
 */
function arrange(projects: Result[], homes: Result[]) {
  const answers = { projects: [...projects], homes: [...homes] };
  rpc.mockImplementation(
    (name: string, args: { p_kind: "homes" | "projects"; p_limit: number }) => {
      expect(name).toBe("sitemap_entries");
      const result = answers[args.p_kind].shift() ?? { data: [], error: null };
      const rows = Array.isArray(result.data) ? result.data.slice(0, args.p_limit) : result.data;
      return Promise.resolve({ ...result, data: rows });
    },
  );
}

const callsOf = (kind: "homes" | "projects") =>
  rpc.mock.calls.filter((call) => call[1].p_kind === kind).map((call) => call[1]);

const homeRows = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    slug: "home",
    short_id: String(start + index).padStart(8, "0"),
    updated_at: "2026-11-02T10:30:00+00:00",
  }));
const projectRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    slug: `project-${index}`,
    short_id: null,
    updated_at: "2026-11-03T08:00:00+00:00",
  }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UT-sitemap-queries: reading what the sitemap lists", () => {
  it("reads live projects and approved homes as an anonymous visitor, only through the sitemap function", async () => {
    arrange([{ data: projectRows(2), error: null }], [{ data: homeRows(3), error: null }]);
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
    // Every read goes through the function (it answers a slug and a date, no other data), never a table.
    expect(new Set(rpc.mock.calls.map((call) => call[0]))).toEqual(new Set(["sitemap_entries"]));
  });

  it("pages through a thousand rows at a time until a short page ends the list", async () => {
    arrange(
      [{ data: [], error: null }],
      [
        { data: homeRows(1000), error: null },
        { data: homeRows(1000, 1000), error: null },
        { data: homeRows(250, 2000), error: null },
      ],
    );
    const sources = await getSitemapSources();
    expect(sources.homes).toHaveLength(2250);
    expect(callsOf("homes").map((args) => [args.p_offset, args.p_limit])).toEqual([
      [0, 1000],
      [1000, 1000],
      [2000, 1000],
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
    arrange(
      [{ data: projectRows(3), error: null }],
      Array.from({ length: 45 }, (_, page) => ({ data: homeRows(1000, page * 1000), error: null })),
    );
    const sources = await getSitemapSources();
    expect(sources.homes.length).toBe(SITEMAP_MAX_URLS - 3 - 3);
    const last = callsOf("homes").at(-1);
    expect((last?.p_offset ?? 0) + (last?.p_limit ?? 0)).toBe(SITEMAP_MAX_URLS - 3 - 3);
    expect(warn).toHaveBeenCalledWith("sitemap reached its address cap", {
      cap: SITEMAP_MAX_URLS - 3 - 3,
    });
  });
});

describe("UT-sitemap-faq: the FAQ page's entry (ADR-143)", () => {
  beforeEach(() => {
    faqState.on = true;
    faqState.faqs = [];
  });

  it("is the date of the newest published question", async () => {
    faqState.faqs = [
      { updatedAt: "2026-11-10T08:00:00+00:00" },
      { updatedAt: "2026-11-20T10:00:00+00:00" },
      { updatedAt: "2026-11-15T09:00:00+00:00" },
    ];
    expect(await getSitemapFaq()).toEqual({ updatedAt: "2026-11-20T10:00:00+00:00" });
  });

  it("is left out while the FAQ module is off, even when questions are published", async () => {
    faqState.on = false;
    faqState.faqs = [{ updatedAt: "2026-11-20T10:00:00+00:00" }];
    expect(await getSitemapFaq()).toBeNull();
  });

  it("is left out while no question is published, so the sitemap never lists an empty page", async () => {
    expect(await getSitemapFaq()).toBeNull();
  });
});

describe("UT-sitemap-blog: the Blog's entries (ADR-143)", () => {
  beforeEach(() => {
    blogState.on = true;
    blogState.posts = [];
  });

  it("is the published articles the cached list gives", async () => {
    blogState.posts = [{ slug: "stamp-duty-explained", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapBlog()).toEqual({ posts: blogState.posts });
  });

  it("is left out while the Blog module is off, even when articles are published", async () => {
    blogState.on = false;
    blogState.posts = [{ slug: "stamp-duty-explained", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapBlog()).toBeNull();
  });

  it("is left out while no article is published, so the sitemap never lists an empty page", async () => {
    expect(await getSitemapBlog()).toBeNull();
  });

  it("does not depend on the FAQ module's switch", async () => {
    faqState.on = false;
    blogState.posts = [{ slug: "one-article", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapBlog()).not.toBeNull();
  });
});

describe("UT-sitemap-careers: the Careers entries (ADR-143)", () => {
  beforeEach(() => {
    careersState.on = true;
    careersState.jobs = [];
  });

  it("is the open jobs the cached list gives", async () => {
    careersState.jobs = [{ slug: "site-engineer", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapCareers()).toEqual({ jobs: careersState.jobs });
  });

  it("is left out while the Careers module is off, even when jobs are open", async () => {
    careersState.on = false;
    careersState.jobs = [{ slug: "site-engineer", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapCareers()).toBeNull();
  });

  it("is left out while no job is open, so the sitemap never lists an empty page", async () => {
    expect(await getSitemapCareers()).toBeNull();
  });

  it("does not depend on the Blog or FAQ switches", async () => {
    faqState.on = false;
    blogState.on = false;
    careersState.jobs = [{ slug: "one-job", updatedAt: "2026-11-10T08:00:00+00:00" }];
    expect(await getSitemapCareers()).not.toBeNull();
  });
});
