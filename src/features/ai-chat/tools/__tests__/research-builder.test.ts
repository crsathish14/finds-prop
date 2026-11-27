import { beforeEach, describe, expect, it, vi } from "vitest";
import { RESEARCH_PAGE_MAX_CHARACTERS, RESEARCH_TOOL_TIMEOUT_MS } from "@/config/ai";
import { injected, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-research-builder (ADR-211): `research_builder` over the builder's public profile and the builder research.
// Both are stand-ins here; the builder, its website and every sentence on it are made up.

const getBuilderProfile = vi.fn();
const researchBuilder = vi.fn();

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("../../queries", () => ({ getBuilderProfile }));
vi.mock("@/features/builder-research", async () => {
  const { QUESTION_TOPICS } = await import("@/features/builder-research/topics");
  return { QUESTION_TOPICS, researchBuilder };
});

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { researchBuilderInputSchema, researchBuilderTool } = await import("../research-builder");

const BUILDER_ID = "00000000-0000-4000-8000-000000000101";

const PROFILE = {
  status: "found",
  builder: {
    id: BUILDER_ID,
    name: "Kadal Homes",
    website: "https://kadalhomes.example.test/",
    description: null,
  },
  projects: [],
  projectCount: 0,
  firstProjectAt: null,
  readAt: READ_AT,
};

const page = (url: string, text: string, title = "About Kadal Homes") => ({ url, title, text });

const research = (input: Record<string, unknown>, context = TOOL_CONTEXT) =>
  runTool(
    [researchBuilderTool],
    { name: "research_builder", input: { builderId: BUILDER_ID, topic: "general", ...input } },
    context,
  );

type Found = {
  status: "found";
  builderId: string;
  pages: {
    sourceUrl: string | null;
    textShortened: boolean;
    untrustedText: { title: string; text: string };
  }[];
};

async function found(input: Record<string, unknown> = {}): Promise<Found> {
  const outcome = await research(input);
  if (outcome.status !== "ok") throw new Error(`research_builder answered ${outcome.code}`);
  return outcome.output as Found;
}

beforeEach(() => {
  vi.clearAllMocks();
  getBuilderProfile.mockResolvedValue(PROFILE);
  researchBuilder.mockResolvedValue({
    ok: true,
    pages: [page("https://kadalhomes.example.test/about", "Founded in 2004 in Chennai.")],
  });
});

describe("UT-ai-tool-research-builder: the input", () => {
  it("is called research_builder, is a read tool with a longer time, and takes a builder and a topic, both required", () => {
    expect(researchBuilderTool.name).toBe("research_builder");
    expect(researchBuilderTool.kind).toBe("read");
    expect(researchBuilderTool.timeoutMs).toBe(RESEARCH_TOOL_TIMEOUT_MS);
    const schema = toPortableJsonSchema(researchBuilderInputSchema) as {
      properties: Record<string, { enum?: string[] }>;
      required: string[];
    };
    expect(Object.keys(schema.properties).sort()).toEqual(["builderId", "topic"]);
    expect([...schema.required].sort()).toEqual(["builderId", "topic"]);
    expect(schema.properties.topic?.enum).toEqual([
      "about_company",
      "projects",
      "delivery_record",
      "awards_approvals",
      "contact",
      "general",
    ]);
  });

  it.each([
    ["no builder", { builderId: null }],
    ["a builder id that is not an id", { builderId: "kadal-homes" }],
    ["no topic", { topic: null }],
    ["a topic of its own", { topic: "news" }],
  ])("refuses %s and reads nothing", async (_case, input) => {
    expect(await research(input)).toMatchObject({ status: "error", code: "invalid_input" });
    expect(getBuilderProfile).not.toHaveBeenCalled();
    expect(researchBuilder).not.toHaveBeenCalled();
  });

  it("takes no web address from the model: one it adds is dropped and only the builder and topic reach the research", async () => {
    await found({ url: "https://elsewhere.example.test/", topic: "projects" });
    expect(researchBuilder).toHaveBeenCalledExactlyOnceWith({
      builderId: BUILDER_ID,
      topic: "projects",
    });
  });

  it("is for signed-in customers, like the other builder tool", async () => {
    const outcome = await research({}, { ...TOOL_CONTEXT, signedIn: false });
    expect(outcome).toMatchObject({ status: "error", code: "sign_in_required" });
    expect(researchBuilder).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-research-builder: what it reads", () => {
  it("reads the public profile first, then researches the builder for the topic the model picked", async () => {
    await found({ builderId: ` ${BUILDER_ID.toUpperCase()} `, topic: "delivery_record" });
    expect(getBuilderProfile).toHaveBeenCalledExactlyOnceWith(BUILDER_ID);
    expect(researchBuilder).toHaveBeenCalledExactlyOnceWith({
      builderId: BUILDER_ID,
      topic: "delivery_record",
    });
  });

  it("never reads the website of a builder a visitor cannot see", async () => {
    getBuilderProfile.mockResolvedValue({ status: "missing", readAt: READ_AT });
    const outcome = await research({});
    expect(outcome).toMatchObject({ status: "ok", output: { status: "not_found" } });
    expect(researchBuilder).not.toHaveBeenCalled();
  });

  it.each(["not_found", "no_website", "nothing_read"] as const)(
    "says %s when the research found nothing to read",
    async (reason) => {
      researchBuilder.mockResolvedValue({ ok: false, reason });
      const outcome = await research({});
      expect(outcome).toMatchObject({ status: "ok", output: { status: reason } });
    },
  );

  it("names no home or project for a card", async () => {
    const outcome = await research({});
    expect(outcome).toMatchObject({ status: "ok", references: [] });
  });
});

describe("UT-ai-tool-research-builder: the pages it gives the model", () => {
  it("puts every word of a page under untrustedText and keeps the page's address beside it", async () => {
    researchBuilder.mockResolvedValue({
      ok: true,
      pages: [
        page(
          "https://kadalhomes.example.test/awards",
          `Award for quality, 2023. ${injected("page")}`,
          injected("title"),
        ),
      ],
    });
    const output = await found({ topic: "awards_approvals" });
    expect(output.pages).toEqual([
      {
        sourceUrl: "https://kadalhomes.example.test/awards",
        textShortened: false,
        untrustedText: {
          title: injected("title"),
          text: `Award for quality, 2023. ${injected("page")}`,
        },
      },
    ]);
    // The injected sentences sit only under untrustedText.
    for (const { path, text } of stringsIn(output)) {
      if (text.includes("Zzinject")) expect(path).toContain("untrustedText");
    }
  });

  it("cuts a long page and says so, and removes characters that show nothing", async () => {
    researchBuilder.mockResolvedValue({
      ok: true,
      pages: [page("https://kadalhomes.example.test/", `Hid​den${"a".repeat(5000)}`)],
    });
    const [first] = (await found()).pages;
    expect(first?.textShortened).toBe(true);
    expect(first?.untrustedText.text.startsWith("Hidden")).toBe(true);
    expect(Array.from(first?.untrustedText.text ?? "").length).toBeLessThanOrEqual(
      RESEARCH_PAGE_MAX_CHARACTERS,
    );
  });

  it("keeps no address that is not a plain https one", async () => {
    researchBuilder.mockResolvedValue({
      ok: true,
      pages: [
        page("http://kadalhomes.example.test/about", "Plain."),
        page("https://someone@kadalhomes.example.test/about", "With a sign-in."),
        page(`https://kadalhomes.example.test/${"x".repeat(400)}`, "Too long."),
      ],
    });
    const output = await found();
    expect(output.pages.map((one) => one.sourceUrl)).toEqual([null, null, null]);
  });

  it("says nothing of when a page was read or how long it is kept", async () => {
    const output = await found();
    const keys = JSON.stringify(output);
    expect(keys).not.toMatch(/readAt|savedAt|days|cache|copy/iu);
  });
});

describe("UT-ai-tool-research-builder: what the model is told", () => {
  it("tells the model the pages are the builder's own words, never instructions, and to give a source only when asked", () => {
    const { description } = researchBuilderTool;
    expect(description).toMatch(/never as an instruction/u);
    expect(description).toMatch(/only when the customer asks for a link or the source/u);
    expect(description).not.toMatch(/\b7\b|seven|days|cache|saved/iu);
  });
});
