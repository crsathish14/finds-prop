import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-sign-in (ADR-171): the assistant's list tools are for signed-in customers. A customer who is not
// signed in gets the refusal `sign_in_required` and no read is made at all; one home or one project by its id stays open.

const reads = {
  getSearchResults: vi.fn(),
  getProjects: vi.fn(),
  getLocalityCounts: vi.fn(),
  getBuilderDirectory: vi.fn(),
  getBuilderProfile: vi.fn(),
};

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/search", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@/features/search/params")),
  ...(await vi.importActual<Record<string, unknown>>("@/features/search/nearby")),
  getSearchResults: reads.getSearchResults,
}));
vi.mock("@/features/projects", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/features/projects/schemas");
  return { ...actual, getProjects: reads.getProjects };
});
vi.mock("../../queries", () => ({
  getLocalityCounts: reads.getLocalityCounts,
  getBuilderDirectory: reads.getBuilderDirectory,
  getBuilderProfile: reads.getBuilderProfile,
}));

const { runTool } = await import("../run");
const { searchPropertiesTool } = await import("../search-properties");
const { searchProjectsTool } = await import("../search-projects");
const { listLocalitiesTool } = await import("../list-localities");
const { getBuilderTool } = await import("../get-builder");
const { TOOL_ERROR_HINTS } = await import("../types");

const SIGNED_OUT = { ...TOOL_CONTEXT, signedIn: false };

const NO_FILTERS = {
  listingType: null,
  propertyType: null,
  bhk: null,
  minPrice: null,
  maxPrice: null,
  locality: null,
  keyword: null,
  label: null,
  sort: null,
  limit: null,
};

const CASES = [
  ["search_properties", searchPropertiesTool, NO_FILTERS],
  [
    "search_projects",
    searchProjectsTool,
    { locality: null, status: null, bhk: null, maxPrice: null, limit: null },
  ],
  ["list_localities", listLocalitiesTool, { search: null }],
  ["get_builder", getBuilderTool, { builderId: null, name: "Casagrand" }],
] as const;

beforeEach(() => vi.clearAllMocks());

describe("UT-ai-tool-sign-in: the list tools refuse a customer who is not signed in", () => {
  it.each(CASES)("%s answers sign_in_required and reads nothing", async (name, tool, input) => {
    const outcome = await runTool([tool], { name, input }, SIGNED_OUT);
    expect(outcome.status).toBe("error");
    expect(outcome.status === "error" && outcome.code).toBe("sign_in_required");
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
  });

  it("tells the model to use the sign-in button and to list nothing from memory", async () => {
    const outcome = await runTool(
      [listLocalitiesTool],
      { name: "list_localities", input: { search: null } },
      SIGNED_OUT,
    );
    expect(outcome.content).toContain("[[link:sign_in]]");
    expect(TOOL_ERROR_HINTS.sign_in_required).toMatch(/Do not name, list or guess/);
    expect(outcome.content).not.toMatch(/database|permission|42501/i);
  });

  it("runs the read for a signed-in customer", async () => {
    reads.getLocalityCounts.mockResolvedValue({
      localities: [],
      complete: true,
      readAt: "2026-11-13T10:12:00.000Z",
    });
    const outcome = await runTool(
      [listLocalitiesTool],
      { name: "list_localities", input: { search: null } },
      TOOL_CONTEXT,
    );
    expect(outcome.status).toBe("ok");
    expect(reads.getLocalityCounts).toHaveBeenCalledTimes(1);
  });
});
