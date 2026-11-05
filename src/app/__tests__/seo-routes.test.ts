import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  appEnv: "production" as string,
  sources: { homes: [], projects: [] } as {
    homes: { slug: string; shortId: string; updatedAt: string }[];
    projects: { slug: string; updatedAt: string }[];
  },
  fail: false,
  connection: vi.fn(async () => undefined),
}));

vi.mock("next/server", () => ({ connection: state.connection }));
vi.mock("@/server/env", () => ({
  env: {
    get APP_ENV() {
      return state.appEnv;
    },
  },
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://findsprop.test" },
}));
vi.mock("@/features/projects", () => ({
  projectPath: (slug: string) => `/projects/${slug}`,
  PROJECTS_PATH: "/projects",
  PROJECTS_TAG: "projects",
}));
vi.mock("@/features/property", () => ({
  propertyPath: (slug: string, shortId: string) => `/properties/${slug}-${shortId}`,
}));
vi.mock("@/features/search", () => ({ SEARCH_PATH: "/properties", LISTINGS_TAG: "home-listings" }));
vi.mock("@/features/sitemap/queries", () => ({
  getSitemapSources: async () => {
    if (state.fail) throw new Error("sitemap homes could not be read");
    return state.sources;
  },
}));

const { default: robots } = await import("../robots");
const { default: sitemap } = await import("../sitemap");

beforeEach(() => {
  state.appEnv = "production";
  state.sources = { homes: [], projects: [] };
  state.fail = false;
  state.connection.mockClear();
});

describe("robots.txt (FR-PUB-14)", () => {
  it("waits for a request, so the environment is read when a crawler asks and not at build", async () => {
    await robots();
    expect(state.connection).toHaveBeenCalledTimes(1);
  });

  it("in production names the sitemap on the site's own address and shuts the private paths", async () => {
    const file = await robots();
    expect(file.sitemap).toBe("https://findsprop.test/sitemap.xml");
    expect(file.rules).toMatchObject({ allow: "/" });
    const disallow = (file.rules as { disallow: string[] }).disallow;
    expect(disallow).toEqual(expect.arrayContaining(["/admin", "/builder", "/dashboard", "/api"]));
  });

  it.each(["development", "test", "preview", "staging"])(
    "shuts every path in the %s environment",
    async (appEnv) => {
      state.appEnv = appEnv;
      expect(await robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    },
  );
});

describe("sitemap.xml (FR-PUB-14)", () => {
  it("waits for a request, so a build never bakes in a list", async () => {
    await sitemap();
    expect(state.connection).toHaveBeenCalledTimes(1);
  });

  it("lists the pages, the projects and the homes, on the site's own address", async () => {
    state.sources = {
      projects: [{ slug: "kadal-vista", updatedAt: "2026-11-03T08:00:00+00:00" }],
      homes: [{ slug: "flat", shortId: "k3x9a2bd", updatedAt: "2026-11-02T10:30:00+00:00" }],
    };
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://findsprop.test/",
      "https://findsprop.test/properties",
      "https://findsprop.test/projects",
      "https://findsprop.test/projects/kadal-vista",
      "https://findsprop.test/properties/flat-k3x9a2bd",
    ]);
  });

  it("fails, so the answer is an error and not a partial list, when a read fails", async () => {
    state.fail = true;
    await expect(sitemap()).rejects.toThrow("sitemap homes could not be read");
  });
});
