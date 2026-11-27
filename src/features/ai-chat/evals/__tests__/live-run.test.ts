import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

// UT-ai-eval-live-run (AI-P8-T01): the function behind the owner's real-model run, played with the fake model, so the
// narrowing, the report and the files are tested without a key or a network call. The real provider is only
// ever created in `live.test.ts`, which does nothing unless the owner turns it on.

vi.mock(import("@/server/logger"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: actual.createLogger({}, { level: "error", write: () => undefined }) };
});
vi.mock("@/features/search", async () => (await import("./world-modules")).searchModule());
vi.mock("@/features/property", async () => (await import("./world-modules")).propertyModule());
vi.mock("@/features/compare", async () => (await import("./world-modules")).compareModule());
vi.mock("@/features/projects", async () => (await import("./world-modules")).projectsModule());
vi.mock("../../queries", async () => (await import("./world-modules")).queriesModule());
vi.mock("@/server/auth/get-session-view", async () =>
  (await import("./world-modules")).sessionModule(),
);
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
}));

const { AI_CHAT_TOOLS, createAiChatTools } = await import("../../tools/registry");
const { createWorldWebSearch, worldPlaceLookup } = await import("../world");
const { createSearchWebTool } = await import("../../tools/search-web");
const { loadCases } = await import("../cases");
const { scriptedProvider } = await import("../eval-run");
const { runAndReport } = await import("../live-run");

const directory = mkdtempSync(path.join(tmpdir(), "ai-evals-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const cases = loadCases();
const run = (selection: Parameters<typeof runAndReport>[0]["selection"]) =>
  runAndReport({
    cases: cases.all,
    tools: AI_CHAT_TOOLS,
    placeTools: createAiChatTools(worldPlaceLookup),
    webToolFor: () => createSearchWebTool(createWorldWebSearch()),
    providerFor: (evalCase, tools) => scriptedProvider(evalCase, tools),
    model: "fake",
    promptVersion: "test-version",
    selection,
    directory,
    now: new Date("2026-11-15T10:00:00Z"),
  });

describe("UT-ai-eval-live-run", () => {
  it("runs a narrowed selection, says it is not a release check, and writes both report files", async () => {
    const result = await run({ set: "golden", limit: "3" });
    expect(result.scores).toHaveLength(3);
    expect(result.whole).toBe(false);
    expect(result.markdownPath).toBe(
      `${directory}/test-version-2026-11-15T10-00-00.000Z-partial.md`,
    );
    expect(readFileSync(result.markdownPath, "utf8")).toContain("# AI chat eval report");
    const json = JSON.parse(readFileSync(result.jsonPath, "utf8")) as {
      whole: boolean;
      promptVersion: string;
      scores: unknown[];
    };
    expect(json).toMatchObject({ whole: false, promptVersion: "test-version" });
    expect(json.scores).toHaveLength(3);
  });

  it("runs the whole set when nothing is narrowed, and names its files without 'partial'", async () => {
    const result = await run({});
    expect(result.whole).toBe(true);
    expect(result.scores).toHaveLength(cases.all.length);
    expect(result.markdownPath).not.toContain("partial");
    expect(result.report).toContain("Prompt version: test-version");
    expect(result.report).toContain("real model (fake)");
    expect(result.verdicts.map((verdict) => verdict.name)).toHaveLength(7);
  });

  it("stops on a bad selection before running anything", async () => {
    await expect(run({ only: "G-nope-99" })).rejects.toThrow(/unknown cases/u);
  });
});
