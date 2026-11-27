/**
 * The real-model run, as a function (AI-P8-T01): narrow the cases, run them with the provider it is given, score them,
 * write the report next to nothing that is committed (`test-results/` is ignored by git), and say whether the rule was
 * met. `__tests__/live.test.ts` calls it with the real provider when the owner runs it; `__tests__/live-run.test.ts`
 * calls it with a scripted one, so the report and the files are tested without a key or a network.
 *
 * This file reads no environment variable and no key: everything comes in as an argument.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { AiProvider } from "@/server/ai";
import type { AnyAiChatTool } from "../tools/types";
import type { EvalCase } from "./case-schema";
import { runAll, selectCases, type Selection } from "./eval-run";
import { judge, renderReport, summarise, type Verdict } from "./report";
import type { CaseScore } from "./score";

export interface LiveRunInput {
  readonly cases: readonly EvalCase[];
  readonly tools: readonly AnyAiChatTool[];
  /** The tools of the cases that turn AI place search on (ADR-142). */
  readonly placeTools?: readonly AnyAiChatTool[];
  /** The web search tool of the cases that offer it (ADR-218), over the made-up websites. */
  readonly webToolFor?: () => AnyAiChatTool;
  readonly providerFor: (evalCase: EvalCase, tools: readonly AnyAiChatTool[]) => AiProvider;
  readonly model: string;
  readonly promptVersion: string;
  readonly selection: Selection;
  /** Where the report files go, created when missing. */
  readonly directory: string;
  readonly now: Date;
  /** Told after each case, so a long run shows where it is. */
  readonly progress?: (line: string) => void;
}

export interface LiveRunResult {
  readonly scores: readonly CaseScore[];
  readonly report: string;
  readonly verdicts: readonly Verdict[];
  /** True when every case ran: only then is the run a release check. */
  readonly whole: boolean;
  readonly markdownPath: string;
  readonly jsonPath: string;
}

export async function runAndReport(input: LiveRunInput): Promise<LiveRunResult> {
  const selected = selectCases(input.cases, input.selection);
  const whole = selected.length === input.cases.length;
  const scores = await runAll(selected, {
    mode: "live",
    tools: input.tools,
    ...(input.placeTools === undefined ? {} : { placeTools: input.placeTools }),
    ...(input.webToolFor === undefined ? {} : { webToolFor: input.webToolFor }),
    providerFor: input.providerFor,
    onScore: (score, position, total) =>
      input.progress?.(`[${position}/${total}] ${score.id} ${score.passed ? "pass" : "FAIL"}`),
  });

  const at = input.now.toISOString();
  const metrics = summarise(scores);
  const verdicts = judge(metrics, "live");
  const report = renderReport({
    mode: "live",
    promptVersion: input.promptVersion,
    model: input.model,
    at,
    scores,
  });
  const stem = `${input.directory}/${input.promptVersion}-${at.replaceAll(":", "-")}${whole ? "" : "-partial"}`;
  mkdirSync(input.directory, { recursive: true });
  writeFileSync(`${stem}.md`, report);
  writeFileSync(
    `${stem}.json`,
    JSON.stringify(
      {
        promptVersion: input.promptVersion,
        model: input.model,
        at,
        whole,
        metrics,
        verdicts,
        scores,
      },
      null,
      2,
    ),
  );
  return { scores, report, verdicts, whole, markdownPath: `${stem}.md`, jsonPath: `${stem}.json` };
}
