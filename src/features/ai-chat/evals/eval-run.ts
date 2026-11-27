/**
 * Runs a list of cases and scores them (AI-P8-T01): the one loop that the offline test and the owner's real-model
 * run share, so the two differ only in the provider they hand over. Cases run one after another, because they share
 * the stand-in world's settings and because a real model's rate limit is the owner's to respect.
 */
import { createFakeAiProvider, type AiProvider } from "@/server/ai";
import type { AnyAiChatTool } from "../tools/types";
import type { EvalCase } from "./case-schema";
import { runCase } from "./run-case";
import { compileScript } from "./script";
import { scoreCase, type CaseScore, type Mode } from "./score";

/** The fake model of a case: it plays the case's script, round by round. */
export function scriptedProvider(evalCase: EvalCase, tools: readonly AnyAiChatTool[]): AiProvider {
  return createFakeAiProvider(compileScript(evalCase.script, tools));
}

export interface RunAllOptions {
  readonly mode: Mode;
  readonly tools: readonly AnyAiChatTool[];
  /**
   * The tools of a case that turns AI place search on (ADR-142): the same list with the place-aware search tool. The
   * provider is asked for a case's model with the tools that case runs with.
   */
  readonly placeTools?: readonly AnyAiChatTool[];
  readonly providerFor: (evalCase: EvalCase, tools: readonly AnyAiChatTool[]) => AiProvider;
  /**
   * Makes the web search tool for a case that offers it (ADR-218), new for each case so its 7-day memory starts empty.
   * The provider of that case is asked with the tools plus this one.
   */
  readonly webToolFor?: () => AnyAiChatTool;
  /** Called after each case, so a long real-model run can show where it is. */
  readonly onScore?: (score: CaseScore, position: number, total: number) => void;
}

export async function runAll(
  cases: readonly EvalCase[],
  options: RunAllOptions,
): Promise<CaseScore[]> {
  const scores: CaseScore[] = [];
  for (const evalCase of cases) {
    const placeSearch = evalCase.placeSearch;
    if (placeSearch && options.placeTools === undefined)
      throw new Error(`${evalCase.id} needs the place-aware tools and none were given`);
    const tools = placeSearch ? (options.placeTools ?? options.tools) : options.tools;
    if (evalCase.webSearch && options.webToolFor === undefined)
      throw new Error(`${evalCase.id} needs the web search tool and none was given`);
    const webTool = evalCase.webSearch ? options.webToolFor?.() : undefined;
    const observed = await runCase(evalCase, {
      provider: options.providerFor(evalCase, webTool === undefined ? tools : [...tools, webTool]),
      tools,
      placeSearch,
      ...(webTool === undefined ? {} : { webSearchTool: webTool }),
    });
    const score = scoreCase(evalCase, observed, options.mode);
    scores.push(score);
    options.onScore?.(score, scores.length, cases.length);
  }
  return scores;
}

export interface Selection {
  /** `golden` or `red_team`: only that set. */
  readonly set?: string | undefined;
  /** Case ids separated by commas: only those. */
  readonly only?: string | undefined;
  /** The first N cases that are left, after the other two. */
  readonly limit?: string | undefined;
}

/**
 * Narrows a run to a few cases, for a cheap first look at the real model (the owner's `AI_EVAL_SET`, `AI_EVAL_ONLY`
 * and `AI_EVAL_LIMIT`). A mistake in the words (an unknown set, an id that does not exist, a limit that is not a
 * number) stops the run before any money is spent, instead of quietly running something else.
 */
export function selectCases(all: readonly EvalCase[], selection: Selection): EvalCase[] {
  let chosen = [...all];
  const set = selection.set?.trim() ?? "";
  if (set !== "") {
    if (set !== "golden" && set !== "red_team")
      throw new Error(`AI_EVAL_SET must be golden or red_team, not "${set}"`);
    chosen = chosen.filter((evalCase) => evalCase.set === set);
  }
  const only = selection.only?.trim() ?? "";
  if (only !== "") {
    const ids = only.split(",").map((id) => id.trim());
    const unknown = ids.filter((id) => !all.some((evalCase) => evalCase.id === id));
    if (unknown.length > 0)
      throw new Error(`AI_EVAL_ONLY names unknown cases: ${unknown.join(", ")}`);
    chosen = chosen.filter((evalCase) => ids.includes(evalCase.id));
  }
  const limit = selection.limit?.trim() ?? "";
  if (limit !== "") {
    const count = Number(limit);
    if (!Number.isInteger(count) || count < 1)
      throw new Error(`AI_EVAL_LIMIT must be a whole number from 1, not "${limit}"`);
    chosen = chosen.slice(0, count);
  }
  if (chosen.length === 0) throw new Error("The selection leaves no case to run");
  return chosen;
}
