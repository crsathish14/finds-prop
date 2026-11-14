import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { forbiddenIn } from "../../../../tests/public-columns";
import {
  BUILDER_COLUMNS,
  BUILDER_DIRECTORY_COLUMNS,
  BUILDER_FIRST_PROJECT_COLUMNS,
  BUILDER_PROJECT_COLUMNS,
} from "../columns";

// UT-ai-builder-read (ADR-128 section 5.1, R-BE-06, R-BE-11): the cached reads behind `get_builder`. They ask
// a visitor's client for the public builder columns and the live projects' own columns only, stamp the time
// inside the cache, and never cache a failure. The database is a stand-in here; the integration test runs the
// same reads against the real one.

type Result = { data: unknown; error: { code: string } | null; count?: number | null };
type Call = { table: string; method: string; args: unknown[] };

const calls: Call[] = [];
const results: Record<string, Result[]> = {};
const tag = vi.fn();
const life = vi.fn();
const error = vi.fn();

/** A query that records every call made on it and can be awaited, or ended with `maybeSingle()`. */
function query(table: string) {
  const answer = () => results[table]?.shift() ?? { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return chain;
    };
  }
  chain.maybeSingle = () => {
    calls.push({ table, method: "maybeSingle", args: [] });
    return Promise.resolve(answer());
  };
  chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(answer()).then(resolve, reject);
  return chain;
}

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({
  createPublicSupabase: () => ({ from: (table: string) => query(table) }),
}));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("@/features/search", () => ({ LISTINGS_TAG: "home-listings" }));
vi.mock("@/features/projects", () => ({
  PROJECTS_TAG: "projects",
  PROJECT_STATUSES: ["new_launch", "under_construction", "ready_to_move"],
}));

const { getBuilderDirectory, getBuilderProfile } = await import("../queries");

const NOW = new Date("2026-11-13T10:12:00.000Z");
const BUILDER_ID = "0b6f9c2e-3d41-4a8e-9f07-2c5d8e1a7b34";

const builderRow = { id: BUILDER_ID, name: "Kadal Homes", website: null, description: null };
const projectRow = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  project_status: "under_construction",
  locality: "OMR Navalur",
  possession_date: "2028-12-31",
  rera_applicable: true,
  rera_number: "TN/SAMPLE/0000",
  created_at: "2026-03-14T06:30:00+00:00",
  ...overrides,
});
const callsTo = (table: string) => calls.filter((call) => call.table === table);

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results.builders = [];
  results.projects = [];
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("UT-ai-builder-read: the columns", () => {
  it.each([
    ["BUILDER_DIRECTORY_COLUMNS", BUILDER_DIRECTORY_COLUMNS],
    ["BUILDER_COLUMNS", BUILDER_COLUMNS],
    ["BUILDER_PROJECT_COLUMNS", BUILDER_PROJECT_COLUMNS],
    ["BUILDER_FIRST_PROJECT_COLUMNS", BUILDER_FIRST_PROJECT_COLUMNS],
  ])("%s names no private column and does not ask for every column", (_name, columns) => {
    expect(forbiddenIn(columns)).toEqual([]);
  });

  it("asks for builder columns a visitor is granted, and never a created-at column of the builder", () => {
    for (const column of ["id", "name", "website", "description"]) {
      expect(BUILDER_COLUMNS).toContain(column);
    }
    expect(BUILDER_COLUMNS).not.toContain("created_at");
    expect(BUILDER_DIRECTORY_COLUMNS).toBe("id, name");
  });
});

describe("UT-ai-builder-read: the builder directory", () => {
  it("asks for the id and the name of the builders a visitor can see, by name", async () => {
    results.builders = [{ data: [{ id: BUILDER_ID, name: "Kadal Homes" }], error: null }];
    const directory = await getBuilderDirectory();
    expect(callsTo("builders")).toEqual([
      { table: "builders", method: "select", args: ["id, name"] },
      { table: "builders", method: "order", args: ["name", { ascending: true }] },
      { table: "builders", method: "limit", args: [1000] },
    ]);
    expect(directory).toEqual({
      builders: [{ id: BUILDER_ID, name: "Kadal Homes" }],
      readAt: NOW.toISOString(),
    });
  });

  it("is cached for minutes under the projects tag, which a builder change refreshes", async () => {
    await getBuilderDirectory();
    expect(tag).toHaveBeenCalledWith("projects");
    expect(life).toHaveBeenCalledWith("minutes");
  });

  it("gives an empty directory when no builder is active", async () => {
    expect(await getBuilderDirectory()).toEqual({ builders: [], readAt: NOW.toISOString() });
  });

  it("throws, so it is never cached, and logs the code only", async () => {
    results.builders = [{ data: null, error: { code: "PGRST301" } }];
    await expect(getBuilderDirectory()).rejects.toThrow("builders could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("throws on rows that are not what was asked for", async () => {
    results.builders = [{ data: [{ id: BUILDER_ID }], error: null }];
    await expect(getBuilderDirectory()).rejects.toThrow(/not fit/);
  });
});

describe("UT-ai-builder-read: one builder's profile", () => {
  it("reads the builder, their newest projects with a count, and their earliest project", async () => {
    results.builders = [{ data: builderRow, error: null }];
    results.projects = [
      { data: [projectRow()], error: null, count: 3 },
      { data: [{ created_at: "2025-11-02T06:30:00+00:00" }], error: null },
    ];
    const profile = await getBuilderProfile(BUILDER_ID);
    expect(callsTo("builders")).toEqual([
      { table: "builders", method: "select", args: [BUILDER_COLUMNS] },
      { table: "builders", method: "eq", args: ["id", BUILDER_ID] },
      { table: "builders", method: "maybeSingle", args: [] },
    ]);
    expect(callsTo("projects")).toEqual([
      {
        table: "projects",
        method: "select",
        args: [BUILDER_PROJECT_COLUMNS, { count: "exact" }],
      },
      { table: "projects", method: "eq", args: ["builder_id", BUILDER_ID] },
      { table: "projects", method: "order", args: ["created_at", { ascending: false }] },
      { table: "projects", method: "limit", args: [MAX_TOOL_RESULT_ITEMS] },
      { table: "projects", method: "select", args: [BUILDER_FIRST_PROJECT_COLUMNS] },
      { table: "projects", method: "eq", args: ["builder_id", BUILDER_ID] },
      { table: "projects", method: "order", args: ["created_at", { ascending: true }] },
      { table: "projects", method: "limit", args: [1] },
    ]);
    expect(profile).toEqual({
      status: "found",
      builder: builderRow,
      projects: [
        {
          slug: "kadal-vista",
          name: "Kadal Vista",
          status: "under_construction",
          locality: "OMR Navalur",
          possessionDate: "2028-12-31",
          reraApplicable: true,
          reraNumber: "TN/SAMPLE/0000",
        },
      ],
      projectCount: 3,
      firstProjectAt: "2025-11-02",
      readAt: NOW.toISOString(),
    });
  });

  it("is cached for minutes under the projects tag", async () => {
    results.builders = [{ data: builderRow, error: null }];
    await getBuilderProfile(BUILDER_ID);
    expect(tag).toHaveBeenCalledWith("projects");
    expect(life).toHaveBeenCalledWith("minutes");
  });

  it("is missing, and reads no project, when no active builder has the id", async () => {
    results.builders = [{ data: null, error: null }];
    expect(await getBuilderProfile(BUILDER_ID)).toEqual({
      status: "missing",
      readAt: NOW.toISOString(),
    });
    expect(callsTo("projects")).toEqual([]);
  });

  it("has no first project, and a count of what it holds, for a builder with no live project", async () => {
    results.builders = [{ data: builderRow, error: null }];
    const profile = await getBuilderProfile(BUILDER_ID);
    expect(profile).toMatchObject({
      status: "found",
      projects: [],
      projectCount: 0,
      firstProjectAt: null,
    });
  });

  it("reads a status this site does not know as no status", async () => {
    results.builders = [{ data: builderRow, error: null }];
    results.projects = [
      { data: [projectRow({ project_status: "sold_out" })], error: null, count: 1 },
      { data: [], error: null },
    ];
    const profile = await getBuilderProfile(BUILDER_ID);
    expect(profile.status === "found" && profile.projects[0]?.status).toBeNull();
  });

  it("throws, and logs the code only, when the builder cannot be read", async () => {
    results.builders = [{ data: null, error: { code: "PGRST301" } }];
    await expect(getBuilderProfile(BUILDER_ID)).rejects.toThrow("builder could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "PGRST301" });
  });

  it("throws when the projects cannot be read, even if the builder can", async () => {
    results.builders = [{ data: builderRow, error: null }];
    results.projects = [
      { data: null, error: { code: "57014" } },
      { data: [], error: null },
    ];
    await expect(getBuilderProfile(BUILDER_ID)).rejects.toThrow("projects could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "57014" });
  });

  it("throws on rows that are not what was asked for", async () => {
    results.builders = [{ data: { id: BUILDER_ID }, error: null }];
    await expect(getBuilderProfile(BUILDER_ID)).rejects.toThrow(/not fit/);
    results.builders = [{ data: builderRow, error: null }];
    results.projects = [
      { data: [{ slug: "x" }], error: null },
      { data: [], error: null },
    ];
    await expect(getBuilderProfile(BUILDER_ID)).rejects.toThrow(/not fit/);
  });
});
