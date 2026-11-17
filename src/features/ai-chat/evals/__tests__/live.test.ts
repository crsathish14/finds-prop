/**
 * MANUAL, THE OWNER RUNS THIS. The real-model run of the golden and red-team sets (AI-P8-T01, ADR-128 section 9).
 *
 * It calls the real OpenAI API, so it costs money and needs the owner's own key. It does nothing, and makes no
 * network call, unless ALL of these are set in the environment of the command that runs it: `AI_EVAL_LIVE=1`,
 * `OPENAI_API_KEY` and `AI_MODEL`. In `npm run test`, in CI and in a developer's shell with a key lying around, at
 * least one is missing, so this file registers no tests. The key is read only through `src/server/env.ts`. Agents
 * never run it and never see the key. The steps, the cost and how to read the report: `README.md` next to the data.
 *
 * The cases, the world (made-up homes), the tools, the input and output checks and the system prompt are exactly the
 * ones the offline run uses (`offline.test.ts`); only the model is real. Narrowing a run (a few cases, one set) is
 * for a cheap first look: a narrowed run writes its report but is not a release check.
 */
import { describe, expect, it, vi } from "vitest";
import { SYSTEM_PROMPT_VERSION } from "../../prompts/version";

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
// The real environment (the key and the model), plus a made-up secret for the propose tools to sign with.
vi.mock(import("@/server/env"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: {
      ...actual.env,
      RATE_LIMIT_HMAC_SECRET:
        actual.env.RATE_LIMIT_HMAC_SECRET ?? "a-made-up-secret-of-thirty-two-chars!",
    },
  };
});

const { env } = await import("@/server/env");

const optedIn = process.env["AI_EVAL_LIVE"] === "1";
const ready = optedIn && env.OPENAI_API_KEY !== undefined && env.AI_MODEL !== undefined;

/** One run takes many minutes: a case can take a minute, and there are over a hundred. */
const RUN_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const REPORT_DIRECTORY = "test-results/ai-evals";

describe.runIf(ready)(
  "LIVE-ai-evals: the golden and red-team sets against the real model (manual, real key)",
  () => {
    it(
      "runs the cases, writes the report, and meets the real-model rule when the whole set ran",
      async () => {
        const { AI_CHAT_TOOLS, createAiChatTools } = await import("../../tools/registry");
        const { worldPlaceLookup } = await import("../world");
        const { chooseAiProvider } = await import("@/server/ai");
        const { checkToolNames, loadCases } = await import("../cases");
        const { runAndReport } = await import("../live-run");

        const cases = loadCases();
        checkToolNames(
          cases.all,
          AI_CHAT_TOOLS.map((tool) => tool.name),
        );
        const provider = chooseAiProvider("openai");
        const result = await runAndReport({
          cases: cases.all,
          tools: AI_CHAT_TOOLS,
          placeTools: createAiChatTools(worldPlaceLookup),
          providerFor: () => provider,
          model: env.AI_MODEL ?? "unknown",
          promptVersion: SYSTEM_PROMPT_VERSION,
          selection: {
            set: process.env["AI_EVAL_SET"],
            only: process.env["AI_EVAL_ONLY"],
            limit: process.env["AI_EVAL_LIMIT"],
          },
          directory: REPORT_DIRECTORY,
          now: new Date(),
          progress: (line) => void process.stdout.write(`${line}\n`),
        });
        process.stdout.write(
          `\n${result.report}\nReport files: ${result.markdownPath} and ${result.jsonPath}\n`,
        );

        if (!result.whole) {
          process.stdout.write("This run was narrowed: it is a look, not a release check.\n");
          return;
        }
        expect(
          result.verdicts.filter((verdict) => !verdict.passed),
          `The prompt version ${SYSTEM_PROMPT_VERSION} does not meet the rule. See ${result.markdownPath}`,
        ).toEqual([]);
      },
      RUN_TIMEOUT_MS,
    );
  },
);
