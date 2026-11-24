import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-sign-in (ADR-171, ADR-197): a guest (a customer who is not signed in, inside the 2-chat limit) may search
// homes (a place is read as an area name), and nothing about projects. Every project tool, the localities and a builder's projects refuse a guest with
// `sign_in_required` and make no read at all; a signed-in customer gets homes and projects.

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
  ...(await vi.importActual<Record<string, unknown>>("@/features/search/schemas")),
  getSearchResults: reads.getSearchResults,
}));
vi.mock("@/features/projects", async () => {
  const schemas = await vi.importActual<Record<string, unknown>>("@/features/projects/schemas");
  const view = await vi.importActual<Record<string, unknown>>("@/features/projects/view");
  const address = await vi.importActual<Record<string, unknown>>("@/features/projects/address");
  return { ...schemas, ...view, ...address, getProjects: reads.getProjects, getProject: vi.fn() };
});
vi.mock("../../queries", () => ({
  getLocalityCounts: reads.getLocalityCounts,
  getBuilderDirectory: reads.getBuilderDirectory,
  getBuilderProfile: reads.getBuilderProfile,
}));

const { runTool } = await import("../run");
const { searchPropertiesTool, createSearchPropertiesTool } = await import("../search-properties");
const { getProjectTool } = await import("../get-project");
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
  ["get_project", getProjectTool, { slug: "kadal-vista" }],
  [
    "search_projects",
    searchProjectsTool,
    { locality: null, status: null, bhk: null, maxPrice: null, limit: null },
  ],
  ["list_localities", listLocalitiesTool, { search: null }],
  ["get_builder", getBuilderTool, { builderId: null, name: "Casagrand" }],
] as const;

beforeEach(() => vi.clearAllMocks());

describe("UT-ai-tool-sign-in: every project tool refuses a guest", () => {
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

const GUEST_HOMES = {
  status: "ok",
  homes: [],
  total: 0,
  readAt: "2026-11-13T10:12:00.000Z",
};

describe("UT-ai-tool-guest-homes: a guest searches homes through the narrow read", () => {
  it("asks for the guest read when the customer is not signed in, and answers", async () => {
    reads.getSearchResults.mockResolvedValue(GUEST_HOMES);
    const outcome = await runTool(
      [searchPropertiesTool],
      { name: "search_properties", input: NO_FILTERS },
      SIGNED_OUT,
    );
    expect(outcome.status).toBe("ok");
    expect(reads.getSearchResults).toHaveBeenCalledTimes(1);
    expect(reads.getSearchResults.mock.calls[0]?.[1]).toEqual({ guest: true });
  });

  it("asks for the customer's own read when signed in", async () => {
    reads.getSearchResults.mockResolvedValue(GUEST_HOMES);
    await runTool(
      [searchPropertiesTool],
      { name: "search_properties", input: NO_FILTERS },
      TOOL_CONTEXT,
    );
    expect(reads.getSearchResults.mock.calls[0]?.[1]).toEqual({ guest: false });
  });

  it("lets a guest search by the filters without a place", async () => {
    const lookup = vi.fn();
    const tool = createSearchPropertiesTool(lookup);
    reads.getSearchResults.mockResolvedValue(GUEST_HOMES);
    const withoutPlace = await runTool(
      [tool],
      { name: "search_properties", input: { ...NO_FILTERS, place: null, radiusKm: null } },
      SIGNED_OUT,
    );
    expect(withoutPlace.status).toBe("ok");
    expect(withoutPlace.content).toContain('"not_asked"');
  });

  // ADR-197: a guest's place is read as an area name through the guest read: no lookup, no distance, and a note.
  it("reads a guest's place as an area name: no lookup, the guest read, the place words as the locality", async () => {
    const lookup = vi.fn();
    const tool = createSearchPropertiesTool(lookup);
    reads.getSearchResults.mockResolvedValue({ ...GUEST_HOMES, total: 3 });
    const outcome = await runTool(
      [tool],
      {
        name: "search_properties",
        input: { ...NO_FILTERS, bhk: 2, place: "Adyar", radiusKm: 4 },
      },
      SIGNED_OUT,
    );
    expect(outcome.status).toBe("ok");
    expect(lookup).not.toHaveBeenCalled();
    const [params, options] = reads.getSearchResults.mock.calls[0] ?? [];
    expect(options).toEqual({ guest: true });
    expect(params).toMatchObject({ locality: "Adyar", bhk: 2 });
    expect(params).not.toHaveProperty("lat");
    expect(params).not.toHaveProperty("radiusKm");
    expect(outcome.content).toContain('"guest_area"');
    expect(outcome.content).toContain("[[link:sign_in]]");
    expect(outcome.content).toMatch(/not homes measured by distance/);
  });

  it("tries a guest's place words once as a keyword when no locality matched, and keeps the note", async () => {
    const lookup = vi.fn();
    const tool = createSearchPropertiesTool(lookup);
    reads.getSearchResults.mockResolvedValue(GUEST_HOMES);
    const outcome = await runTool(
      [tool],
      {
        name: "search_properties",
        input: { ...NO_FILTERS, place: "Guindy station", radiusKm: null },
      },
      SIGNED_OUT,
    );
    expect(outcome.status).toBe("ok");
    expect(reads.getSearchResults).toHaveBeenCalledTimes(2);
    expect(reads.getSearchResults.mock.calls[1]?.[0]).toMatchObject({ keyword: "Guindy station" });
    expect(outcome.content).toContain('"guest_area"');
    expect(outcome.content).toMatch(/If no homes matched, say so plainly/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("still looks the place up for a signed-in customer", async () => {
    const lookup = vi.fn().mockResolvedValue({ status: "not_found" });
    const tool = createSearchPropertiesTool(lookup);
    const outcome = await runTool(
      [tool],
      { name: "search_properties", input: { ...NO_FILTERS, place: "Velachery", radiusKm: null } },
      TOOL_CONTEXT,
    );
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(outcome.content).toContain('"not_found"');
    expect(outcome.content).not.toContain("guest_area");
  });

  it("tells the model what a guest may still do", () => {
    expect(TOOL_ERROR_HINTS.sign_in_required).toMatch(
      /Homes can still be searched without signing in/,
    );
  });
});
