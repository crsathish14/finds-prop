import { beforeAll, describe, expect, it, vi } from "vitest";
import { SYSTEM_PROMPT_VERSION } from "../../prompts/version";
import type { CaseScore } from "../score";

// The offline eval run (AI-P8-T01, ADR-128 section 9): every golden and red-team case, played through the real
// endpoint with the fake model, the real tools over a made-up world, and the real input and output checks. It is
// part of `npm run test`. It uses no network and no key. A failure here means a guard, a tool, the prompt, the
// loop or a case changed: read the failing case's checks below. The real-model half is `live.test.ts`.

vi.mock(import("@/server/logger"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: actual.createLogger({}, { level: "error", write: () => undefined }) };
});
vi.mock("@/features/search", async () => (await import("./world-modules")).searchModule());
vi.mock("@/features/property", async () => (await import("./world-modules")).propertyModule());
vi.mock("@/features/compare", async () => (await import("./world-modules")).compareModule());
vi.mock("@/features/projects", async () => (await import("./world-modules")).projectsModule());
vi.mock("../../queries", async () => (await import("./world-modules")).queriesModule());
vi.mock("@/features/blog", async () => (await import("./world-modules")).blogModule());
vi.mock("@/features/faq", async () => (await import("./world-modules")).faqModule());
vi.mock("@/features/careers", async () => (await import("./world-modules")).careersModule());
vi.mock("@/features/site", async () => (await import("./world-modules")).siteModule());
vi.mock("@/server/auth/get-session-view", async () =>
  (await import("./world-modules")).sessionModule(),
);
// The propose tools sign what they prepare with this made-up secret.
vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
}));

const { AI_CHAT_TOOLS, createAiChatTools } = await import("../../tools/registry");
const { worldPlaceLookup } = await import("../world");
const { checkToolNames, loadCases } = await import("../cases");
const { runAll, scriptedProvider } = await import("../eval-run");
const { judge, renderReport, runPassed, summarise } = await import("../report");

// The cases that turn AI place search on run with the place-aware search tool over the world's own place lookup.
const PLACE_TOOLS = createAiChatTools(worldPlaceLookup);

const cases = loadCases();
checkToolNames(
  cases.all,
  AI_CHAT_TOOLS.map((tool) => tool.name),
);

describe("UT-ai-eval-offline: the golden and red-team sets, scripted", () => {
  const scores = new Map<string, CaseScore>();

  beforeAll(async () => {
    const all = await runAll(cases.all, {
      mode: "offline",
      tools: AI_CHAT_TOOLS,
      placeTools: PLACE_TOOLS,
      providerFor: (evalCase, tools) => scriptedProvider(evalCase, tools),
    });
    for (const score of all) scores.set(score.id, score);
  });

  for (const evalCase of cases.all) {
    it(`${evalCase.id}: ${evalCase.title}`, () => {
      const score = scores.get(evalCase.id);
      expect(score, "the case was not run").toBeDefined();
      const failed = (score?.checks ?? [])
        .filter((entry) => !entry.passed && entry.hard)
        .map((entry) => `${entry.name}: ${entry.detail}`);
      expect(failed, `what the customer read: ${score?.excerpt ?? ""}`).toEqual([]);
    });
  }

  it("meets every offline threshold, and the report says so", () => {
    const all = cases.all.flatMap((evalCase) => scores.get(evalCase.id) ?? []);
    const verdicts = judge(summarise(all), "offline");
    const failing = verdicts.filter((verdict) => !verdict.passed);
    expect(
      failing,
      renderReport({
        mode: "offline",
        promptVersion: SYSTEM_PROMPT_VERSION,
        model: "fake",
        at: "offline",
        scores: all,
      }),
    ).toEqual([]);
    expect(runPassed(verdicts)).toBe(true);
  });
});
