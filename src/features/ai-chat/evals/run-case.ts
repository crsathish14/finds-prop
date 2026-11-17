/**
 * Runs one case through the REAL endpoint (AI-P8-T01): `handleAiChat`, so the request check, the input pre-check,
 * the system prompt, the agent loop, the real tools (over the stand-in world), the output check and the usage row
 * all run exactly as they do for a customer. Only three things are stood in: the model (the fake provider, or the
 * real one in the owner's run), the database reads under the tools (`world.ts`), and the limits (not under test).
 *
 * What comes back is a plain record of what happened (`Observed`); scoring it is `score.ts`. This file never decides
 * pass or fail and never reads a key: the provider is given to it.
 */
import { AI_MESSAGE_HARD_STOP_MS, AI_MESSAGE_TIME_LIMIT_MS } from "@/config/ai";
import type { AiCall, AiProvider } from "@/server/ai";
import { handleAiChat } from "../endpoint/handler";
import type { ChatOutcome, ChatStreamEvent } from "../endpoint/events";
import type { ChatDeps, ChatUsageRecord } from "../endpoint/types";
import { TOOL_CONTEXT } from "../tools/__tests__/fixtures";
import type { AnyAiChatTool } from "../tools/types";
import type { EvalCase } from "./case-schema";
import { CUSTOMER_SESSION, resetWorld, WORLD_IDS } from "./world";

const ORIGIN = "http://localhost:3000";

/** One tool call the model made and the tool ran (a call the tool's own input check refused is not recorded). */
export interface ObservedToolCall {
  readonly name: string;
  readonly input: unknown;
  /** The result, or `null` when the read failed. */
  readonly output: unknown;
  readonly ok: boolean;
}

/** What the customer would have seen and what happened behind it. */
export interface Observed {
  /** The HTTP status; anything but 200 means the endpoint answered before any stream began. */
  readonly status: number;
  readonly outcome: ChatOutcome | null;
  /** The model's text as the customer reads it (the `text` events, joined). */
  readonly answerText: string;
  /** Everything the customer reads: the answer, a replacement line, the notices. */
  readonly visibleText: string;
  readonly replaced: boolean;
  readonly noticeKeys: readonly string[];
  /** The cards drawn, as `home:<id>` and `project:<slug>`. */
  readonly cards: readonly string[];
  readonly usage: ChatUsageRecord | null;
  readonly toolCalls: readonly ObservedToolCall[];
  /** Every word given to the model across all its calls: the system prompt, the messages and the tool results. */
  readonly modelSaw: string;
  readonly modelCalls: number;
}

export interface RunOptions {
  readonly provider: AiProvider;
  readonly tools: readonly AnyAiChatTool[];
  /** True when `tools` hold the place-aware search, so the prompt carries the rules for places (ADR-142). */
  readonly placeSearch?: boolean;
  /** Milliseconds; the real limits by default. The offline run passes shorter ones. */
  readonly timing?: { readonly timeLimitMs: number; readonly hardStopMs: number };
}

function modelSawText(calls: readonly AiCall[]): string {
  const parts: string[] = [];
  for (const call of calls) {
    parts.push(call.system);
    for (const message of call.messages)
      parts.push(message.role === "tool" ? message.content : message.text);
  }
  return parts.join("\n");
}

function parseEvents(body: string): ChatStreamEvent[] {
  return body
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as ChatStreamEvent);
}

export async function runCase(evalCase: EvalCase, options: RunOptions): Promise<Observed> {
  resetWorld({
    session: evalCase.session === "customer" ? CUSTOMER_SESSION : null,
    failingTools: evalCase.failingTools,
    ownedHomeIds: evalCase.ownedHomes,
    placesDown: evalCase.placesDown,
  });

  const toolCalls: ObservedToolCall[] = [];
  const instrumented = options.tools.map((tool): AnyAiChatTool => ({
    ...tool,
    async run(input, context) {
      try {
        const result = await tool.run(input, context);
        toolCalls.push({ name: tool.name, input, output: result.output, ok: true });
        return result;
      } catch (error) {
        toolCalls.push({ name: tool.name, input, output: null, ok: false });
        throw error;
      }
    },
  }));

  const modelCalls: AiCall[] = [];
  const recording: AiProvider = {
    name: options.provider.name,
    stream(call) {
      modelCalls.push(call);
      return options.provider.stream(call);
    },
  };

  const usageRows: ChatUsageRecord[] = [];
  const deps: ChatDeps = {
    isEnabled: () => true,
    getSession: async () => (evalCase.session === "customer" ? CUSTOMER_SESSION : null),
    // The limits are not under test here; they have their own tests.
    enforceLimits: async () => undefined,
    createProvider: () => recording,
    tools: instrumented,
    ...(options.placeSearch === true ? { placeSearch: true } : {}),
    translate: TOOL_CONTEXT.translate,
    recordUsage: async (record) => void usageRows.push(record),
    // The ticked homes are checked against the made-up world, as the real reads check them against what is listed.
    contextReads: {
      homeIsOpen: async (id) => WORLD_IDS.homes.includes(id),
      projectIsOpen: async (slug) => WORLD_IDS.projects.includes(slug),
      openHomeIds: async (ids) => ids.filter((id) => WORLD_IDS.homes.includes(id)),
    },
    timing: options.timing ?? {
      timeLimitMs: AI_MESSAGE_TIME_LIMIT_MS,
      hardStopMs: AI_MESSAGE_HARD_STOP_MS,
    },
  };

  const response = await handleAiChat(
    new Request(`${ORIGIN}/api/ai/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000" },
      body: JSON.stringify({
        messages: evalCase.messages,
        ...(evalCase.compare.length === 0 ? {} : { context: { compare: evalCase.compare } }),
      }),
    }),
    deps,
  );
  const events = response.status === 200 ? parseEvents(await response.text()) : [];

  const texts = events.flatMap((event) => (event.type === "text" ? [event.text] : []));
  const replaced = events.flatMap((event) => (event.type === "replace" ? [event.text] : []));
  const notices = events.flatMap((event) => (event.type === "notice" ? [event] : []));
  const done = events.find((event) => event.type === "done");
  const answerText = texts.join("");
  return {
    status: response.status,
    outcome: done?.type === "done" ? done.outcome : null,
    answerText,
    visibleText: [answerText, ...replaced, ...notices.map((notice) => notice.text)].join("\n"),
    replaced: replaced.length > 0,
    noticeKeys: notices.map((notice) => notice.key),
    cards: events.flatMap((event) =>
      event.type === "card"
        ? [
            event.reference.kind === "home"
              ? `home:${event.reference.homeId}`
              : `project:${event.reference.slug}`,
          ]
        : [],
    ),
    usage: usageRows[0] ?? null,
    toolCalls,
    modelSaw: modelSawText(modelCalls),
    modelCalls: modelCalls.length,
  };
}
