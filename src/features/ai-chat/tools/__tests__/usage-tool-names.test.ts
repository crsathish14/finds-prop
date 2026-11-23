import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// UT-ai-usage-tool-names (ADR-143 section 6.10): a usage row stores the names of the tools that ran as snake_case text,
// and the table's own check accepts any such name, so a new tool needs no migration. This test reads the migration and
// the registry: the check's pattern accepts every registered tool name, including the two content tools, and the
// number of names a turn can hold is far under the table's limit.

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
}));
// The job tools take the work modes and types from the Careers feature (ADR-143 section 6).
vi.mock("@/features/careers", async () => {
  const { EMPLOYMENT_TYPES, WORK_MODES } = await import("@/features/careers/constants");
  return { EMPLOYMENT_TYPES, WORK_MODES };
});
vi.mock("../../content-queries", () => ({
  searchContent: vi.fn(),
  readContentItem: vi.fn(),
  searchJobs: vi.fn(),
}));
vi.mock("../../queries", () => ({
  getLocalityCounts: vi.fn(),
  getBuilderDirectory: vi.fn(),
  getBuilderProfile: vi.fn(),
  ownsHome: vi.fn(),
}));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: vi.fn() }));
vi.mock("@/features/search", async () => {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults: vi.fn(),
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
});
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty: vi.fn(), amenityList, perSqftRupees };
});
vi.mock("@/features/projects", async () => {
  const { bhkSizes, priceOf, TREND_MONTHS } = await import("@/features/projects/view");
  const { isProjectSlug } = await import("@/features/projects/address");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    bhkSizes,
    priceOf,
    TREND_MONTHS,
    isProjectSlug,
    visitDateProblem,
    OFFER_TYPES,
    PRICE_TYPES,
    PROJECT_STATUSES,
    PROJECT_LIST_LIMIT: 60,
  };
});
vi.mock("@/features/compare", async () => {
  const { COMPARE_MAX, COMPARE_MIN } = await import("@/features/compare/store");
  return { getComparedHomes: vi.fn(), COMPARE_MAX, COMPARE_MIN };
});

const { createAiChatTools } = await import("../registry");

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261114130000_ai_usage_events.sql"),
  "utf8",
);

describe("UT-ai-usage-tool-names: no migration for a new tool name", () => {
  it("reads the pattern and the count limit the usage table checks tool names with", () => {
    const check =
      /tools_ran text\[\] not null default '\{\}'\s*check \(cardinality\(tools_ran\) <= (\d+) and array_to_string\(tools_ran, ','\) ~ '([^']+)'\)/.exec(
        MIGRATION,
      );
    expect(check, "the tools_ran check was not found in the usage migration").not.toBeNull();
    const limit = Number(check?.[1]);
    const names = new RegExp(check?.[2] ?? "(?!)");
    const registered = createAiChatTools().map((tool) => tool.name);
    expect(registered).toEqual(
      expect.arrayContaining(["search_content", "search_jobs", "get_content_item"]),
    );
    for (const name of registered) expect(names.test(name), name).toBe(true);
    // The names of one turn are the tools that ran, each once: never more than the registry holds.
    expect(registered.length).toBeLessThanOrEqual(limit);
    // The pattern is the snake_case shape and refuses anything else.
    expect(names.test("search_content,get_content_item")).toBe(true);
    expect(names.test("Search Content")).toBe(false);
    expect(names.test("search-content")).toBe(false);
  });
});
