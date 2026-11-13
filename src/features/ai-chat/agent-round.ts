import "server-only";
import {
  aiFailureFromThrown,
  describeAiFailure,
  type AiCall,
  type AiFailure,
  type AiProvider,
} from "@/server/ai";
import { logger } from "@/server/logger";
import type { RoundCall } from "./agent-calls";
import type { AgentUsage } from "./agent-types";

/**
 * One request to the provider, read to its end (ADR-128 section 4.5). The loop never shows text while a round
 * is still running, because a round that ends with a tool call must show nothing: so a whole round is read
 * first and only then is it known whether its text is the answer.
 */

export type ModelRound =
  | {
      readonly status: "ok";
      /** Why the round ended. `length` means the answer was cut off by the output cap. */
      readonly reason: "end" | "tool_use" | "length";
      readonly text: string;
      /** The pieces the text arrived in, kept so the answer can still stream to the customer. */
      readonly deltas: readonly string[];
      readonly calls: readonly RoundCall[];
    }
  | { readonly status: "refused" }
  | { readonly status: "failed"; readonly failure: AiFailure };

/** The tokens of the message so far. Rounds add to it as they are read, failed ones included: they cost too. */
export type UsageTotals = { -readonly [Key in keyof AgentUsage]: AgentUsage[Key] };

export async function streamRound(
  provider: AiProvider,
  call: AiCall,
  usage: UsageTotals,
): Promise<ModelRound> {
  const deltas: string[] = [];
  const calls: RoundCall[] = [];
  let reason: "end" | "tool_use" | "length" | null = null;

  try {
    for await (const event of provider.stream(call)) {
      if (event.type === "text_delta") deltas.push(event.text);
      else if (event.type === "tool_call")
        calls.push({ id: event.id, name: event.name, input: event.input });
      else if (event.type === "usage") {
        usage.inputTokens += event.inputTokens;
        usage.outputTokens += event.outputTokens;
        usage.cachedInputTokens += event.cachedInputTokens ?? 0;
      } else if (event.reason === "error") {
        return { status: "failed", failure: event.failure };
      } else if (event.reason === "refusal") {
        return { status: "refused" };
      } else {
        reason = event.reason;
      }
      if (reason !== null) break;
    }
  } catch (error) {
    // The adapter reports its own failures as a `stop`; anything thrown is mapped here and never logged with its message.
    logger.warn("ai provider stream threw");
    return { status: "failed", failure: aiFailureFromThrown(error) };
  }

  const text = deltas.join("");
  // No `stop`, or a round that says nothing and asks for nothing, is a stream that was cut off or empty.
  const empty = text.trim() === "" && calls.length === 0;
  if (
    reason === null ||
    (reason !== "length" && empty) ||
    (reason === "tool_use" && calls.length === 0)
  ) {
    return { status: "failed", failure: describeAiFailure("interrupted") };
  }
  return { status: "ok", reason, text, deltas, calls };
}
