import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { forbiddenIn, NEVER_PUBLIC_ON_HOMES } from "../../../../tests/public-columns";
import { LOCALITY_HOME_COLUMNS, LOCALITY_PROJECT_COLUMNS } from "../columns";

// UT-ai-localities-read (ADR-128 section 5.1, R-BE-06, R-BE-11): the cached read behind `list_localities`.
// It asks a visitor's client for the locality and nothing else, pages through the rows, and never caches a
// failure. The database is a stand-in here; the integration test runs the same read against the real one.

type Page = { data: unknown; error: { code: string } | null };
type Call = { table: string; columns: string; order: unknown[]; range: [number, number] };

const pages: Record<string, Page[]> = {};
const calls: Call[] = [];
const tag = vi.fn();
const life = vi.fn();
const error = vi.fn();

function from(table: string) {
  return {
    select: (columns: string) => ({
      order: (...order: unknown[]) => ({
        range: (start: number, end: number): Promise<Page> => {
          calls.push({ table, columns, order, range: [start, end] });
          return Promise.resolve(pages[table]?.shift() ?? { data: [], error: null });
        },
      }),
    }),
  };
}

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from }) }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The two features are stood in for by their tag names, as the sitemap's test does; a test below checks
// that these are the central tags.
vi.mock("@/features/search", () => ({ LISTINGS_TAG: "home-listings" }));
vi.mock("@/features/projects", () => ({ PROJECTS_TAG: "projects" }));

const { getLocalityCounts } = await import("../queries");

const NOW = new Date("2026-11-13T10:12:00.000Z");
const rows = (...names: (string | null)[]) => ({
  data: names.map((locality) => ({ locality })),
  error: null,
});
const fullPage = (name: string) => rows(...Array.from({ length: 1000 }, () => name));
const callsTo = (table: string) => calls.filter((call) => call.table === table);

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  pages.properties = [];
  pages.projects = [];
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("UT-ai-localities-read: what is asked for", () => {
  it("asks for the locality only, of homes and of projects of active builders", async () => {
    await getLocalityCounts();
    expect(callsTo("properties")).toEqual([
      {
        table: "properties",
        columns: "locality",
        order: ["short_id", { ascending: true }],
        range: [0, 999],
      },
    ]);
    expect(callsTo("projects")).toEqual([
      {
        table: "projects",
        columns: "locality, builders!inner(id)",
        order: ["slug", { ascending: true }],
        range: [0, 999],
      },
    ]);
  });

  it("names no private column (the same check as the public pages, IT-queries)", () => {
    expect(forbiddenIn(LOCALITY_HOME_COLUMNS, NEVER_PUBLIC_ON_HOMES)).toEqual([]);
    expect(forbiddenIn(LOCALITY_PROJECT_COLUMNS)).toEqual([]);
  });

  it("is cached for minutes under the homes tag and the projects tag", async () => {
    await getLocalityCounts();
    expect(tag).toHaveBeenCalledWith(CACHE_TAGS.listings, CACHE_TAGS.projects);
    expect(life).toHaveBeenCalledWith("minutes");
  });
});

describe("UT-ai-localities-read: what comes back", () => {
  it("counts the localities of homes and projects, and says when it read them", async () => {
    pages.properties = [rows("Velachery", "Velachery", "Adyar", null)];
    pages.projects = [rows("Adyar")];
    expect(await getLocalityCounts()).toEqual({
      localities: [
        { name: "Adyar", homes: 1, projects: 1 },
        { name: "Velachery", homes: 2, projects: 0 },
      ],
      complete: true,
      readAt: "2026-11-13T10:12:00.000Z",
    });
  });

  it("gives an empty, complete list when nothing is listed", async () => {
    expect(await getLocalityCounts()).toEqual({
      localities: [],
      complete: true,
      readAt: "2026-11-13T10:12:00.000Z",
    });
  });

  it("reads the next page when a page comes back full, and stops at a short one", async () => {
    pages.properties = [fullPage("Velachery"), rows("Adyar")];
    const counts = await getLocalityCounts();
    expect(callsTo("properties").map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(counts.localities).toEqual([
      { name: "Velachery", homes: 1000, projects: 0 },
      { name: "Adyar", homes: 1, projects: 0 },
    ]);
    expect(counts.complete).toBe(true);
  });

  it("stops at ten thousand homes and says the counts are not complete", async () => {
    pages.properties = Array.from({ length: 12 }, () => fullPage("Velachery"));
    const counts = await getLocalityCounts();
    expect(callsTo("properties")).toHaveLength(10);
    expect(callsTo("properties").at(-1)?.range).toEqual([9000, 9999]);
    expect(counts.localities).toEqual([{ name: "Velachery", homes: 10_000, projects: 0 }]);
    expect(counts.complete).toBe(false);
  });

  it("stops at one thousand projects and says the counts are not complete", async () => {
    pages.projects = [fullPage("Porur"), fullPage("Porur")];
    const counts = await getLocalityCounts();
    expect(callsTo("projects")).toHaveLength(1);
    expect(counts.complete).toBe(false);
  });
});

describe("UT-ai-localities-read: a failed read", () => {
  it("throws, so it is never cached, and logs the code and the table only", async () => {
    pages.properties = [{ data: null, error: { code: "57014" } }];
    await expect(getLocalityCounts()).rejects.toThrow("localities could not be read");
    expect(error).toHaveBeenCalledWith("localities could not be read", {
      errorCode: "57014",
      source: "homes",
    });
  });

  it("throws when the projects cannot be read, even if the homes can", async () => {
    pages.properties = [rows("Velachery")];
    pages.projects = [{ data: null, error: { code: "42501" } }];
    await expect(getLocalityCounts()).rejects.toThrow("localities could not be read");
    expect(error).toHaveBeenCalledWith("localities could not be read", {
      errorCode: "42501",
      source: "projects",
    });
  });

  it("throws on rows that are not what was asked for", async () => {
    pages.properties = [{ data: [{ locality: 42 }], error: null }];
    await expect(getLocalityCounts()).rejects.toThrow(
      "locality rows do not fit the expected shape",
    );
    expect(error).toHaveBeenCalledWith("locality rows do not fit the expected shape", {
      source: "homes",
    });
  });
});
