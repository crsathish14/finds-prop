import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMemory, SearchPage } from "../types";
import { projectData, READ_AT, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-compare-projects (ADR-207): `compare_projects` over the project page's own cached read.
// The read is a stand-in here; the projects are made up.

const getProject = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/features/projects", async () => {
  const schemas = await vi.importActual<Record<string, unknown>>("@/features/projects/schemas");
  const view = await vi.importActual<Record<string, unknown>>("@/features/projects/view");
  const address = await vi.importActual<Record<string, unknown>>("@/features/projects/address");
  return { ...schemas, ...view, ...address, getProject };
});

const { runTool } = await import("../run");
const { compareProjectsTool } = await import("../compare-projects");

type Compared = {
  status: string;
  projects: {
    slug: string;
    pricePerSqftRupees: number | null;
    matchReasons: string[];
    missedPreferences: string[];
    untrustedText: { amenitiesOnlyHere: string[] };
  }[];
  notFound: string[];
  differences: {
    price: { lowestSlug: string | null; highestSlug: string | null; gapText: string } | null;
    pricePerSqft: { lowestSlug: string | null } | null;
    earliestPossessionSlug: string | null;
    latestPossessionSlug: string | null;
    mostUnitsAvailableSlug: string | null;
  };
  untrustedText: { amenitiesInCommon: string[] };
};

const PROJECTS = {
  "kadal-vista": projectData({
    slug: "kadal-vista",
    price: 7_800_000,
    priceType: "basic",
    possessionDate: "2028-12-31",
    availableCount: 4,
    amenities: ["Gym", "Pool"],
    locality: "OMR Navalur",
    bhkOptions: [2, 3],
  }),
  "velan-gardens": projectData({
    slug: "velan-gardens",
    name: "Velan Gardens",
    price: 4_800_000,
    priceType: "basic",
    possessionDate: "2029-03-31",
    availableCount: 9,
    amenities: ["gym", "Park"],
    locality: "Tambaram",
    bhkOptions: [1, 2],
  }),
  "rate-towers": projectData({
    slug: "rate-towers",
    price: 8_500,
    priceType: "per_sqft",
    possessionDate: null,
    availableCount: 4,
    amenities: [],
  }),
};

function memoryWith(page: SearchPage | null): SearchMemory {
  return {
    shownBefore: () => [],
    seenBefore: () => false,
    record: () => undefined,
    current: () => page,
  };
}

const compare = (slugs: string[], context = TOOL_CONTEXT) =>
  runTool([compareProjectsTool], { name: "compare_projects", input: { slugs } }, context);

async function compared(slugs: string[], context = TOOL_CONTEXT): Promise<Compared> {
  const outcome = await compare(slugs, context);
  if (outcome.status !== "ok") throw new Error(`the call failed: ${outcome.content}`);
  return outcome.output as Compared;
}

beforeEach(() => {
  vi.clearAllMocks();
  getProject.mockImplementation(async (slug: string) => {
    const project = PROJECTS[slug as keyof typeof PROJECTS];
    return project === undefined
      ? { status: "missing", readAt: READ_AT }
      : { status: "found", readAt: READ_AT, project };
  });
});

describe("UT-ai-tool-compare-projects: the input", () => {
  it("takes 2 to 4 different slugs", async () => {
    expect((await compare(["kadal-vista"])).status).toBe("error");
    expect((await compare(["kadal-vista", "Kadal-Vista "])).status).toBe("error");
    expect((await compare(["a-1", "b-2", "c-3", "d-4", "e-5"])).status).toBe("error");
    expect((await compare(["kadal-vista", "velan-gardens"])).status).toBe("ok");
  });

  it("refuses a guest, like the other project tools (ADR-171)", async () => {
    const outcome = await compare(["kadal-vista", "velan-gardens"], {
      ...TOOL_CONTEXT,
      signedIn: false,
    });
    expect(outcome.status === "error" && outcome.code).toBe("sign_in_required");
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-compare-projects: the differences are worked out in code", () => {
  it("names the lower and higher price, the possession months and the most units", async () => {
    const result = await compared(["kadal-vista", "velan-gardens"]);
    expect(result.status).toBe("compared");
    expect(result.differences.price).toMatchObject({
      lowestSlug: "velan-gardens",
      highestSlug: "kadal-vista",
    });
    expect(result.differences.price?.gapText).toContain("30");
    expect(result.differences.earliestPossessionSlug).toBe("kadal-vista");
    expect(result.differences.latestPossessionSlug).toBe("velan-gardens");
    expect(result.differences.mostUnitsAvailableSlug).toBe("velan-gardens");
  });

  it("compares no price when the types differ, and gives a rate per sq ft only where it is one", async () => {
    const result = await compared(["kadal-vista", "rate-towers"]);
    expect(result.differences.price).toBeNull();
    expect(result.projects.map((project) => project.pricePerSqftRupees)).toEqual([null, 8_500]);
    expect(result.differences.pricePerSqft).toBeNull();
    expect(result.differences.earliestPossessionSlug).toBeNull();
    expect(result.differences.mostUnitsAvailableSlug).toBeNull();
  });

  it("splits the amenities into the ones in common and the ones only one lists, whatever their capitals", async () => {
    const result = await compared(["kadal-vista", "velan-gardens"]);
    expect(result.untrustedText.amenitiesInCommon).toEqual(["Gym"]);
    expect(result.projects.map((project) => project.untrustedText.amenitiesOnlyHere)).toEqual([
      ["Pool"],
      ["Park"],
    ]);
  });

  it("names a project that is not listed and needs two that are", async () => {
    const result = await compared(["kadal-vista", "velan-gardens", "gone-away"]);
    expect(result.notFound).toEqual(["gone-away"]);
    const outcome = await compare(["kadal-vista", "gone-away"]);
    expect(outcome.status === "ok" && outcome.output).toMatchObject({
      status: "not_enough_projects",
      listedCount: 1,
      notFound: ["gone-away"],
    });
  });

  it("says nothing about promotion: no tier, featured or sponsored field", async () => {
    const outcome = await compare(["kadal-vista", "velan-gardens"]);
    expect(outcome.status === "ok" && outcome.content).not.toMatch(/featured|sponsor|tier|promot/i);
  });
});

describe("UT-ai-tool-compare-projects: the fit against the chat's current project search", () => {
  it("says what each project meets and misses of the remembered wants", async () => {
    const memory = memoryWith({
      tool: "search_projects",
      filters: {
        bhk: 3,
        maxPrice: 6_000_000,
        preferLocalities: ["Navalur"],
        preferAmenities: ["pool"],
      },
      shown: [],
      total: 2,
      place: false,
    });
    const result = await compared(["kadal-vista", "velan-gardens"], {
      ...TOOL_CONTEXT,
      search: memory,
    });
    const [kadal, velan] = result.projects;
    expect(kadal?.matchReasons).toEqual(["has 3 BHK", "in a preferred area (Navalur)", "has pool"]);
    expect(kadal?.missedPreferences).toEqual(["above the budget"]);
    expect(velan?.matchReasons).toEqual(["within the budget"]);
    expect(velan?.missedPreferences).toEqual([
      "no 3 BHK",
      "not in a preferred area",
      "pool not listed",
    ]);
  });

  it("gives no reasons without a project search", async () => {
    const homes = memoryWith({
      tool: "search_properties",
      filters: { bhk: 3 },
      shown: [],
      total: 1,
      place: false,
    });
    for (const context of [TOOL_CONTEXT, { ...TOOL_CONTEXT, search: homes }]) {
      const result = await compared(["kadal-vista", "velan-gardens"], context);
      for (const project of result.projects) {
        expect(project.matchReasons).toEqual([]);
        expect(project.missedPreferences).toEqual([]);
      }
    }
  });
});
