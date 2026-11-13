import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { injected, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-localities (ADR-128 sections 3 and 5.1): `list_localities` over the cached localities read.
// The read is a stand-in here; the counts are made up.

const getLocalityCounts = vi.fn();
const error = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("../../queries", () => ({ getLocalityCounts }));

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { listLocalitiesInputSchema, listLocalitiesOutputSchema, listLocalitiesTool } =
  await import("../list-localities");

const list = (input: unknown) =>
  runTool([listLocalitiesTool], { name: "list_localities", input }, TOOL_CONTEXT);

const LISTED = [
  { name: "Velachery", homes: 12, projects: 1 },
  { name: "Anna Nagar", homes: 9, projects: 0 },
  { name: "Adyar", homes: 7, projects: 2 },
  { name: "Thiruvanmiyur", homes: 4, projects: 0 },
];
const counts = (localities = LISTED, complete = true) => ({
  localities,
  complete,
  readAt: "2026-11-13T10:12:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  getLocalityCounts.mockResolvedValue(counts());
});

describe("UT-ai-tool-localities: the input", () => {
  it("is called list_localities and takes the customer's text, or null", () => {
    expect(listLocalitiesTool.name).toBe("list_localities");
    expect(toPortableJsonSchema(listLocalitiesInputSchema)).toMatchObject({
      type: "object",
      properties: { search: { type: ["string", "null"] } },
      required: ["search"],
      additionalProperties: false,
    });
  });

  it.each([
    ["text of more than 80 characters", { search: "v".repeat(81) }],
    ["a number", { search: 600042 }],
    ["nothing at all", {}],
  ])("refuses %s and reads nothing", async (_case, input) => {
    expect(await list(input)).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["search"],
    });
    expect(getLocalityCounts).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-localities: the result", () => {
  it("lists the busiest localities with their counts when no text is given", async () => {
    expect(await list({ search: null })).toEqual({
      status: "ok",
      output: {
        asOf: "13 Nov 2026, 3:42 pm",
        total: 4,
        countsComplete: true,
        localities: [
          { homes: 12, projects: 1, untrustedText: { name: "Velachery" } },
          { homes: 9, projects: 0, untrustedText: { name: "Anna Nagar" } },
          { homes: 7, projects: 2, untrustedText: { name: "Adyar" } },
          { homes: 4, projects: 0, untrustedText: { name: "Thiruvanmiyur" } },
        ],
      },
      references: [],
      content: expect.any(String),
    });
  });

  it("finds Velachery for Velacheri", async () => {
    expect(await list({ search: "Velacheri" })).toMatchObject({
      output: {
        total: 4,
        localities: [{ homes: 12, projects: 1, untrustedText: { name: "Velachery" } }],
      },
    });
  });

  it("gives an empty list when nothing close is listed, and still says how many localities there are", async () => {
    expect(await list({ search: "Coimbatore" })).toMatchObject({
      status: "ok",
      output: { total: 4, localities: [] },
    });
  });

  it("says when the counts were read, in India time", async () => {
    getLocalityCounts.mockResolvedValue({ ...counts(), readAt: "2026-11-13T19:05:00.000Z" });
    expect(await list({ search: null })).toMatchObject({
      output: { asOf: "14 Nov 2026, 12:35 am" },
    });
  });

  it("says when the counts are only 'at least'", async () => {
    getLocalityCounts.mockResolvedValue(counts(LISTED, false));
    expect(await list({ search: null })).toMatchObject({ output: { countsComplete: false } });
  });

  it("never gives more than ten localities, and says how many there are in all", async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      name: `Made-up Nagar ${index + 1}`,
      homes: 100 - index,
      projects: 0,
    }));
    getLocalityCounts.mockResolvedValue(counts(many));
    const outcome = await list({ search: null });
    const output = JSON.parse(outcome.content);
    expect(MAX_TOOL_RESULT_ITEMS).toBe(10);
    expect(output.localities).toHaveLength(10);
    expect(output.total).toBe(25);
    expect(output.localities[0]).toEqual({
      homes: 100,
      projects: 0,
      untrustedText: { name: "Made-up Nagar 1" },
    });
  });

  it("refuses, by its own schema, a list of more than ten localities", () => {
    const eleven = Array.from({ length: 11 }, () => ({
      homes: 1,
      projects: 0,
      untrustedText: { name: "Made-up Nagar" },
    }));
    const result = { asOf: "13 Nov 2026, 3:42 pm", total: 11, countsComplete: true };
    expect(listLocalitiesOutputSchema.safeParse({ ...result, localities: eleven }).success).toBe(
      false,
    );
    expect(
      listLocalitiesOutputSchema.safeParse({ ...result, localities: eleven.slice(0, 10) }).success,
    ).toBe(true);
  });

  it("names no home, so there is nothing for the loop to track", async () => {
    expect(await list({ search: null })).toMatchObject({ references: [] });
  });

  it("keeps a locality name, which a lister typed, under untrustedText", async () => {
    getLocalityCounts.mockResolvedValue(
      counts([{ name: injected("locality"), homes: 1, projects: 0 }]),
    );
    const outcome = await list({ search: null });
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual(["localities.0.untrustedText.name"]);
  });

  it("answers 'unavailable' when the read fails", async () => {
    getLocalityCounts.mockRejectedValue(new Error("localities could not be read"));
    expect(await list({ search: null })).toEqual({
      status: "error",
      code: "unavailable",
      fields: [],
      content: '{"error":"unavailable"}',
    });
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", {
      tool: "list_localities",
    });
  });
});
