import "server-only";
import { MAX_PARALLEL_READ_CALLS, TOOL_TIMEOUT_MS } from "@/config/ai";
import { runTool, toolError } from "./tools/run";
import type { AnyAiChatTool, ToolContext, ToolOutcome } from "./tools/types";

/**
 * Runs the tool calls of one round under the parallel rules of ADR-128 section 4.5. Every call gets exactly
 * one result, in the order of the calls, even when it is refused. The loop (`agent.ts`) never calls a tool
 * itself: it comes through here, and from here through `runTool`.
 */

/** One call the model asked for. `input` is whatever the provider produced; `runTool` checks it. */
export interface RoundCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface RoundResult {
  readonly callId: string;
  readonly outcome: ToolOutcome;
}

export interface RoundRun {
  /** One result per call, in the order of the calls. */
  readonly results: readonly RoundResult[];
  /** Calls that were really run: not refused, and not a repeat of an earlier call in the round. */
  readonly attempted: number;
  /** The names of the known tools that were run, each once. */
  readonly ranNames: readonly string[];
}

/** The same value written the same way whatever order the keys came in, so equal calls compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([first], [second]) => (first < second ? -1 : 1));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/** The tool's result, or a `timeout` result when it takes longer than `TOOL_TIMEOUT_MS` or the caller stops. */
function raceTimeout(work: Promise<ToolOutcome>, signal?: AbortSignal): Promise<ToolOutcome> {
  return new Promise((resolve, reject) => {
    const timedOut = () => resolve(toolError("timeout"));
    const timer = setTimeout(timedOut, TOOL_TIMEOUT_MS);
    signal?.addEventListener("abort", timedOut, { once: true });
    work.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", timedOut);
    });
  });
}

/**
 * `budget` is how many more calls this customer message may make. In call order: a propose tool that shares its
 * round gets `call_alone`; a call that repeats an earlier one shares that one's result; past
 * `MAX_PARALLEL_READ_CALLS` the call gets `too_many_calls`; past the budget it gets `call_limit`. The rest run
 * together, each raced against `TOOL_TIMEOUT_MS`, and one that fails or times out affects only its own result.
 */
export async function runRoundCalls(options: {
  tools: readonly AnyAiChatTool[];
  calls: readonly RoundCall[];
  context: ToolContext;
  budget: number;
  signal?: AbortSignal | undefined;
}): Promise<RoundRun> {
  const { tools, calls, context, budget, signal } = options;
  const slots: Promise<ToolOutcome>[] = [];
  const firstSlotOf = new Map<string, number>();
  const ranNames = new Set<string>();
  let attempted = 0;

  calls.forEach((call, index) => {
    const key = `${call.name}\u0000${canonical(call.input)}`;
    const earlier = slots[firstSlotOf.get(key) ?? -1];
    if (earlier !== undefined) {
      slots.push(earlier);
      return;
    }
    firstSlotOf.set(key, index);
    const tool = tools.find((candidate) => candidate.name === call.name);
    if (tool?.kind === "propose" && calls.length > 1) {
      slots.push(Promise.resolve(toolError("call_alone")));
    } else if (attempted >= MAX_PARALLEL_READ_CALLS) {
      slots.push(Promise.resolve(toolError("too_many_calls")));
    } else if (attempted >= budget) {
      slots.push(Promise.resolve(toolError("call_limit")));
    } else {
      attempted += 1;
      if (tool !== undefined) ranNames.add(tool.name);
      slots.push(raceTimeout(runTool(tools, call, context), signal));
    }
  });

  const outcomes = await Promise.all(slots);
  return {
    results: calls.map((call, index) => ({
      callId: call.id,
      outcome: outcomes[index] ?? toolError("unavailable"),
    })),
    attempted,
    ranNames: [...ranNames],
  };
}
