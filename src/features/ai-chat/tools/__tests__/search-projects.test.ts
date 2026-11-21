import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { AS_OF_TEXT, injected, projectListItem, READ_AT, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-projects-search (ADR-128 section 5.1): `search_projects` over the projects page's own cached
// list, filtered in code. The read is a stand-in here; the projects are made up.

const getProjects = vi.fn();
const error = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The projects feature is stood in for by its read (a stand-in) and its real page rules.
vi.mock("@/features/projects", async () => {
  const { bhkSizes, priceOf } = await import("@/features/projects/view");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  return {
    getProjects,
    bhkSizes,
    priceOf,
    OFFER_TYPES,
    PRICE_TYPES,
    PROJECT_STATUSES,
    PROJECT_LIST_LIMIT: 60,
  };
});

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { searchProjectsInputSchema, searchProjectsOutputSchema, searchProjectsTool } =
  await import("../search-projects");

const NO_FILTERS = { locality: null, status: null, bhk: null, maxPrice: null, limit: null };
const search = (filters: Record<string, unknown> = {}) =>
  runTool(
    [searchProjectsTool],
    { name: "search_projects", input: { ...NO_FILTERS, ...filters } },
    TOOL_CONTEXT,
  );

type Summary = Record<string, unknown>;

/** The projects a search gave, or a failure the test cannot go on from. */
async function projectsFor(filters: Record<string, unknown> = {}): Promise<Summary[]> {
  const outcome = await search(filters);
  if (outcome.status !== "ok") throw new Error(`the search answered ${outcome.code}`);
  return (outcome.output as { projects: Summary[] }).projects;
}

const slugsFor = async (filters: Record<string, unknown>) =>
  (await projectsFor(filters)).map((project) => project.slug);

const PROJECTS = [
  projectListItem({ slug: "kadal-vista", locality: "OMR Navalur" }),
  projectListItem({
    slug: "velan-heights",
    name: "Velan Heights",
    developerName: "Velan Builders",
    status: "ready_to_move",
    price: 5_500_000,
    priceType: "all_inclusive",
    bhkOptions: [1, 2],
    locality: "Velachery",
  }),
  projectListItem({
    slug: "no-price-yet",
    name: "No Price Yet",
    status: "new_launch",
    price: null,
    priceType: null,
    bhkOptions: [3],
    locality: "Velachery",
  }),
  projectListItem({
    slug: "plot-gardens",
    name: "Plot Gardens",
    status: null,
    price: 2_450,
    priceType: "per_sqft",
    bhkOptions: [0],
    locality: "T. Nagar",
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  getProjects.mockResolvedValue({ status: "ok", projects: PROJECTS, readAt: READ_AT });
});

describe("UT-ai-tool-projects-search: the input", () => {
  it("is called search_projects, is a read tool, and takes the five filters, each required", () => {
    expect(searchProjectsTool.name).toBe("search_projects");
    expect(searchProjectsTool.kind).toBe("read");
    const schema = toPortableJsonSchema(searchProjectsInputSchema) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties).sort()).toEqual(
      ["bhk", "limit", "locality", "maxPrice", "status"].sort(),
    );
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
  });

  it("accepts every filter as null", async () => {
    expect((await search()).status).toBe("ok");
  });

  it.each([
    ["a status the site does not have", { status: "sold_out" }],
    ["five bedrooms", { bhk: 5 }],
    ["half a bedroom", { bhk: 2.5 }],
    ["a negative price", { maxPrice: -1 }],
    ["a price above twelve digits", { maxPrice: 1_000_000_000_000 }],
    ["a limit of eleven", { limit: 11 }],
    ["a limit of zero", { limit: 0 }],
    ["a locality over 80 characters", { locality: "x".repeat(81) }],
    ["a missing field", { status: undefined }],
  ])("refuses %s and reads nothing", async (_case, filters) => {
    const outcome = await search(filters);
    expect(outcome).toMatchObject({ status: "error", code: "invalid_input" });
    expect(getProjects).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-projects-search: the filters", () => {
  it("gives every project when nothing is asked for, in the order the page lists them", async () => {
    expect(await slugsFor({})).toEqual([
      "kadal-vista",
      "velan-heights",
      "no-price-yet",
      "plot-gardens",
    ]);
  });

  it("matches a locality by its words, ignoring capitals and punctuation", async () => {
    expect(await slugsFor({ locality: "velachery" })).toEqual(["velan-heights", "no-price-yet"]);
    expect(await slugsFor({ locality: "OMR" })).toEqual(["kadal-vista"]);
    expect(await slugsFor({ locality: "t nagar" })).toEqual(["plot-gardens"]);
  });

  it("matches nothing, not everything, for a locality made only of punctuation", async () => {
    expect(await slugsFor({ locality: "..." })).toEqual([]);
  });

  it("treats a blank locality as not given", async () => {
    expect(await slugsFor({ locality: "   " })).toHaveLength(4);
  });

  it("matches a status exactly, and a project with no status matches none", async () => {
    expect(await slugsFor({ status: "ready_to_move" })).toEqual(["velan-heights"]);
    expect(await slugsFor({ status: "new_launch" })).toEqual(["no-price-yet"]);
  });

  it("matches a BHK size the project offers, and not a size 0, which is no bedroom count", async () => {
    expect(await slugsFor({ bhk: 2 })).toEqual(["kadal-vista", "velan-heights"]);
    expect(await slugsFor({ bhk: 1 })).toEqual(["velan-heights"]);
    expect(await slugsFor({ bhk: 4 })).toEqual([]);
  });

  it("matches a maximum price against a price that is a total (basic or all inclusive), and never a project with no price", async () => {
    expect(await slugsFor({ maxPrice: 6_000_000 })).toEqual(["velan-heights"]);
    expect(await slugsFor({ maxPrice: 7_800_000 })).toEqual(["kadal-vista", "velan-heights"]);
    expect(await slugsFor({ maxPrice: 1_000_000 })).toEqual([]);
  });

  it("leaves a project priced per sq ft, or for rent, out of a maximum price, even a very high one", async () => {
    getProjects.mockResolvedValue({
      status: "ok",
      projects: [
        projectListItem({ slug: "by-the-sqft", price: 2_450, priceType: "per_sqft" }),
        projectListItem({
          slug: "office-for-rent",
          price: 85_000,
          priceType: "rent_per_month",
          offerType: "rent",
        }),
        projectListItem({ slug: "a-total", price: 9_000_000, priceType: "basic" }),
      ],
      readAt: READ_AT,
    });
    expect(await slugsFor({ maxPrice: 999_999_999_999 })).toEqual(["a-total"]);
    expect(await slugsFor({ maxPrice: 3_000 })).toEqual([]);
    expect(await slugsFor({})).toEqual(["by-the-sqft", "office-for-rent", "a-total"]);
  });

  it("combines every filter", async () => {
    expect(
      await slugsFor({
        locality: "velachery",
        status: "ready_to_move",
        bhk: 2,
        maxPrice: 6_000_000,
      }),
    ).toEqual(["velan-heights"]);
    expect(await slugsFor({ locality: "velachery", status: "under_construction" })).toEqual([]);
  });
});

describe("UT-ai-tool-projects-search: what comes back", () => {
  it("gives the facts of a project, with money as the pages write it", async () => {
    const outcome = await search({ locality: "OMR" });
    expect(outcome).toEqual({
      status: "ok",
      output: {
        asOf: AS_OF_TEXT,
        total: 1,
        searchedAll: true,
        projects: [
          {
            slug: "kadal-vista",
            status: "under_construction",
            bhkOptions: [2, 3],
            priceRupees: 7_800_000,
            priceText: "₹78 L basic price",
            priceType: "basic",
            offerType: null,
            untrustedText: {
              name: "Kadal Vista",
              developerName: "Kadal Homes",
              locality: "OMR Navalur",
            },
          },
        ],
      },
      references: [{ kind: "project", slug: "kadal-vista" }],
      content: expect.any(String),
    });
  });

  it("gives the one price with what it means, and no price as null", async () => {
    const projects = await projectsFor({ locality: "velachery" });
    expect(projects[0]).toMatchObject({
      priceRupees: 5_500_000,
      priceText: "₹55 L all inclusive",
      priceType: "all_inclusive",
    });
    expect(projects[1]).toMatchObject({
      priceRupees: null,
      priceText: null,
      priceType: null,
    });
  });

  it("writes each price type the way the project page does, and says when a project is for rent", async () => {
    getProjects.mockResolvedValue({
      status: "ok",
      projects: [
        projectListItem({ slug: "a", price: 8_500, priceType: "per_sqft" }),
        projectListItem({
          slug: "b",
          price: 45_000,
          priceType: "rent_per_month",
          offerType: "rent",
        }),
        projectListItem({
          slug: "c",
          price: 85,
          priceType: "rent_per_sqft_month",
          offerType: "rent",
        }),
      ],
      readAt: READ_AT,
    });
    const projects = await projectsFor();
    expect(projects.map((project) => project.priceText)).toEqual([
      "₹8,500 per sq ft",
      "₹45,000 per month",
      "₹85 per sq ft per month",
    ]);
    expect(projects.map((project) => project.offerType)).toEqual([null, "rent", "rent"]);
  });

  it("names every project it gives, and no other, in the references", async () => {
    const outcome = await search({ limit: 2 });
    expect(outcome.status === "ok" && outcome.references).toEqual([
      { kind: "project", slug: "kadal-vista" },
      { kind: "project", slug: "velan-heights" },
    ]);
  });

  it("gives the number that match in all, though fewer are returned", async () => {
    const outcome = await search({ limit: 1 });
    expect(outcome).toMatchObject({ status: "ok", output: { total: 4 } });
    expect(await projectsFor({ limit: 1 })).toHaveLength(1);
  });

  it("gives at most ten projects, though the list holds more", async () => {
    getProjects.mockResolvedValue({
      status: "ok",
      projects: Array.from({ length: 25 }, (_, index) =>
        projectListItem({ slug: `project-${index}` }),
      ),
      readAt: READ_AT,
    });
    const outcome = await search();
    expect(outcome).toMatchObject({ status: "ok", output: { total: 25 } });
    expect(outcome.status === "ok" && outcome.references).toHaveLength(MAX_TOOL_RESULT_ITEMS);
    expect(
      searchProjectsOutputSchema.safeParse(outcome.status === "ok" ? outcome.output : null).success,
    ).toBe(true);
  });

  it("says when the list it searched was at its size limit", async () => {
    getProjects.mockResolvedValue({
      status: "ok",
      projects: Array.from({ length: 60 }, (_, index) =>
        projectListItem({ slug: `project-${index}` }),
      ),
      readAt: READ_AT,
    });
    expect(await search()).toMatchObject({ status: "ok", output: { searchedAll: false } });
  });

  it("gives an empty list, not an error, when no project is listed", async () => {
    getProjects.mockResolvedValue({ status: "ok", projects: [], readAt: READ_AT });
    expect(await search()).toMatchObject({
      status: "ok",
      output: { total: 0, searchedAll: true, projects: [] },
      references: [],
    });
  });

  it("keeps everything the developer typed under untrustedText, cleaned", async () => {
    // U+0007 is a control character that draws nothing; it is written as a number, not typed.
    const bell = String.fromCodePoint(0x07);
    getProjects.mockResolvedValue({
      status: "ok",
      projects: [
        projectListItem({
          name: injected("name"),
          developerName: injected("developer"),
          locality: `${injected("locality")}${bell}`,
        }),
      ],
      readAt: READ_AT,
    });
    const [project] = await projectsFor();
    const { untrustedText, ...facts } = project ?? {};
    expect(JSON.stringify(facts)).not.toContain("Zzinject");
    expect(untrustedText).toEqual({
      name: injected("name"),
      developerName: injected("developer"),
      locality: injected("locality"),
    });
  });
});

describe("UT-ai-tool-projects-search: when the read fails", () => {
  it("answers unavailable, not an exception, and not an empty list", async () => {
    getProjects.mockResolvedValue({ status: "failed" });
    expect(await search()).toMatchObject({ status: "error", code: "unavailable" });
  });

  it("answers unavailable when the read throws, without the reason", async () => {
    getProjects.mockRejectedValue(new Error("the database said no"));
    const outcome = await search();
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
    expect(outcome.content).not.toContain("the database said no");
  });
});
