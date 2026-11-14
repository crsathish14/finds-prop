import "server-only";
import type { AiProvider } from "@/server/ai";
import type { SessionView } from "@/server/auth/session";
import { logger, withLogContext } from "@/server/logger";
import { RateLimitedError } from "@/server/rate-limit/enforce";
import { AI_CHAT_RATE_LIMIT_SCOPES } from "@/server/rate-limit/limits";
import type { AiChatRateLimitScope } from "@/server/rate-limit/rate-limit";
import { readRequestId } from "@/server/request-id";
import { INPUT_MESSAGE_KEYS, type InputCheckResult } from "../guards/input";
import { buildSystemPrompt } from "../prompts/system-prompt";
import { SYSTEM_PROMPT_VERSION } from "../prompts/version";
import { encodeChatEvent, type ChatOutcome, type ChatStreamEvent } from "./events";
import { prepareConversation } from "./history";
import { parseChatRequest } from "./parse";
import {
  invalidRequestResponse,
  limitResponse,
  notFoundResponse,
  serverErrorResponse,
} from "./responses";
import { runTurn, FALLBACK_HREF, type TurnSummary } from "./turn";
import type { ChatDeps, ChatUsageRecord } from "./types";

/**
 * `POST /api/ai/chat` (ADR-128 sections 4, 6 and 7; decision D-STREAM). The route file only calls this; the steps
 * run in this fixed order, the same as `defineAction` where they apply, and it writes no data:
 *
 *   1 flag (404 when off)   2 parse   3 session (optional)   4 input pre-check   5 limits
 *   6 agent loop   7 output check   8 stream   9 usage
 *
 * Steps 1 to 5 end in a plain JSON answer (404, 400/403/413/415, 401/429 with the screen to show, 500). From step 6 the
 * answer is a stream of events (`events.ts`). The message text is never logged, stored or put in an error; every log
 * line carries the request id (`withLogContext`, so the loop, the tools and the guards carry it too).
 */

const ROUTE = "ai-chat";

/**
 * The limits a message that the input check refused counts toward: the short limit only (ADR-128 section 7.1, "input
 * pre-check refusals count toward the burst limit only"). It made no model call, so it spends neither the free trial
 * nor the daily budget, and a refusal (or a check that failed on our side) never costs a customer a free message.
 */
const REFUSAL_LIMITS: readonly AiChatRateLimitScope[] = ["ai_chat_burst"];

export async function handleAiChat(request: Request, deps: ChatDeps): Promise<Response> {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  return withLogContext({ requestId, route: ROUTE }, () => handle(request, deps, requestId));
}

async function handle(request: Request, deps: ChatDeps, requestId: string): Promise<Response> {
  const started = Date.now();
  let session: SessionView | null = null;
  const usage = (outcome: ChatOutcome, extra: Partial<ChatUsageRecord> = {}) =>
    saveUsage(deps, {
      requestId,
      at: new Date(started).toISOString(),
      caller: session === null ? "anonymous" : "signed_in",
      userId: session?.userId ?? null,
      promptVersion: SYSTEM_PROMPT_VERSION,
      outcome,
      limitedBy: null,
      inputTags: [],
      outputTags: [],
      outputCounts: {},
      numberUngrounded: 0,
      rounds: 0,
      retried: false,
      toolCallsPerRound: [],
      toolsRan: [],
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      agentLimit: null,
      fallbackReason: null,
      durationMs: Date.now() - started,
      ...extra,
    });

  try {
    // 1 flag: the kill switch. Nothing else runs, so nothing about the endpoint is learned while it is off.
    if (!deps.isEnabled()) return notFoundResponse();

    // 2 parse
    const parsed = await parseChatRequest(request);
    if (!parsed.ok) {
      logger.info("ai chat request refused", { status: parsed.status });
      return invalidRequestResponse(parsed.status, requestId);
    }

    // 3 session: from the verified token only. If it cannot be read the message is refused (fail closed).
    session = await deps.getSession();

    // 4 input pre-check, on the new message and the earlier customer turns
    const { latest, history } = prepareConversation(parsed.request.messages);
    const inputTags = latest.tags;

    // 5 limits. A message the input check refused is answered with its fixed reply and counts toward fewer limits.
    const spend = async (scopes?: readonly AiChatRateLimitScope[]): Promise<Response | null> => {
      try {
        await deps.enforceLimits({
          session,
          requestId,
          ...(scopes === undefined ? {} : { scopes }),
        });
        return null;
      } catch (error) {
        const scope =
          error instanceof RateLimitedError
            ? AI_CHAT_RATE_LIMIT_SCOPES.find((known) => known === error.scope)
            : undefined;
        if (!(error instanceof RateLimitedError) || scope === undefined) throw error;
        logger.info("ai chat limited", { scope });
        await usage("rate_limited", { limitedBy: scope, inputTags });
        return limitResponse(scope, error.retryAfter, requestId, deps.translate);
      }
    };
    if (latest.action === "refuse") {
      const limited = await spend(REFUSAL_LIMITS);
      if (limited !== null) return limited;
      return streamResponse(requestId, deps, () =>
        refusalEvents(deps, requestId, latest.messageKey, usage, inputTags),
      );
    }

    // A server that is not set up must not spend a visitor's free message, so the provider is made before the limits.
    const provider = deps.createProvider();
    const limited = await spend();
    if (limited !== null) return limited;

    // 6 to 9: the agent loop, the output check, the stream, usage
    const system = buildSystemPrompt({
      translate: deps.translate,
      addInjectionReminder: latest.addReminder,
    });
    const conversation = [...history, { role: "user" as const, text: latest.text }];
    return streamResponse(requestId, deps, (stop) =>
      answerEvents({
        deps,
        requestId,
        request,
        started,
        provider,
        system,
        conversation,
        latest,
        usage,
        stop,
      }),
    );
  } catch (error) {
    logger.error("ai chat failed", { error });
    try {
      await deps.reportError?.(error, { source: "handler", requestId, route: ROUTE });
    } catch {
      // Reporting an error must never become a second error.
    }
    await usage("error");
    return serverErrorResponse(requestId, deps.translate);
  }
}

// ---------------------------------------------------------------- usage

async function saveUsage(deps: ChatDeps, record: ChatUsageRecord): Promise<void> {
  try {
    await deps.recordUsage(record);
  } catch (error) {
    // The usage step never changes what the customer gets.
    logger.error("ai chat usage could not be recorded", { error });
  }
}

type UsageWriter = (outcome: ChatOutcome, extra?: Partial<ChatUsageRecord>) => Promise<void>;

// ---------------------------------------------------------------- the streams

/** A fixed reply from the input check: no model call, one `text` event. */
async function* refusalEvents(
  deps: ChatDeps,
  requestId: string,
  messageKey: string,
  usage: UsageWriter,
  inputTags: ChatUsageRecord["inputTags"],
): AsyncGenerator<ChatStreamEvent> {
  let outcome: ChatOutcome = "error";
  try {
    yield { type: "start", requestId };
    if (messageKey === INPUT_MESSAGE_KEYS.failedClosed) {
      yield {
        type: "replace",
        key: messageKey,
        text: deps.translate(messageKey),
        href: FALLBACK_HREF,
      };
    } else {
      yield { type: "text", text: deps.translate(messageKey) };
    }
    outcome = "refused";
    yield { type: "done", outcome };
  } finally {
    await usage(outcome, { inputTags });
  }
}

interface AnswerInput {
  readonly deps: ChatDeps;
  readonly requestId: string;
  readonly request: Request;
  /** When the request arrived: the time limit and the hard stop count from here, not from when the stream is built. */
  readonly started: number;
  readonly provider: AiProvider;
  readonly system: string;
  readonly conversation: Parameters<typeof runTurn>[0]["messages"];
  readonly latest: Exclude<InputCheckResult, { action: "refuse" }>;
  readonly usage: UsageWriter;
  readonly stop: AbortController;
}

async function* answerEvents(input: AnswerInput): AsyncGenerator<ChatStreamEvent> {
  const { deps, latest } = input;
  const { timing } = deps;
  const remaining = (limitMs: number) => Math.max(1, limitMs - (Date.now() - input.started));
  const customerLeft = () => input.request.signal.aborted || input.stop.signal.aborted;
  const signal = AbortSignal.any([
    input.stop.signal,
    input.request.signal,
    AbortSignal.timeout(remaining(timing.hardStopMs)),
  ]);
  const timeLimit = AbortSignal.timeout(remaining(timing.timeLimitMs));

  let summary: TurnSummary | null = null;
  let outcome: ChatOutcome = "error";
  try {
    yield { type: "start", requestId: input.requestId };
    if (latest.action === "mask") {
      yield {
        type: "notice",
        key: latest.noticeKey,
        text: deps.translate(latest.noticeKey),
      };
    }
    const turn = runTurn({
      provider: input.provider,
      tools: deps.tools,
      translate: deps.translate,
      system: input.system,
      messages: input.conversation,
      customerMessage: latest.text,
      signal,
      timeLimit,
    });
    while (true) {
      const next = await turn.next();
      if (next.done) {
        summary = next.value;
        break;
      }
      yield next.value;
    }
    outcome = summary.outcome;
    // The hard stop (not the customer leaving) ended the turn: the customer gets the fixed fallback, not silence.
    if (outcome === "aborted" && !customerLeft()) {
      outcome = "fallback";
      yield {
        type: "replace",
        key: INPUT_MESSAGE_KEYS.failedClosed,
        text: deps.translate(INPUT_MESSAGE_KEYS.failedClosed),
        href: FALLBACK_HREF,
      };
    }
    yield { type: "done", outcome };
  } finally {
    const agent = summary?.agent ?? null;
    // Names and numbers only: the outcome, never what was said.
    logger.info("ai chat finished", { outcome, rounds: agent?.rounds ?? 0 });
    await input.usage(outcome, {
      inputTags: latest.tags,
      outputTags: summary?.output?.tags ?? [],
      outputCounts: summary?.output?.counts ?? {},
      numberUngrounded: summary?.output?.shadow.numberUngrounded ?? 0,
      rounds: agent?.rounds ?? 0,
      retried: agent?.retried ?? false,
      toolCallsPerRound: agent?.toolCallsPerRound ?? [],
      toolsRan: agent?.toolsRan ?? [],
      inputTokens: agent?.usage.inputTokens ?? 0,
      outputTokens: agent?.usage.outputTokens ?? 0,
      cachedInputTokens: agent?.usage.cachedInputTokens ?? 0,
      agentLimit: agent?.limit ?? null,
      fallbackReason: agent?.fallbackReason ?? null,
    });
  }
}

/**
 * The response: events are written as they are produced, one line each. If the customer leaves (the stream is
 * cancelled) the loop is stopped. An unexpected failure after the stream began ends it with the fixed fallback.
 */
function streamResponse(
  requestId: string,
  deps: ChatDeps,
  events: (stop: AbortController) => AsyncGenerator<ChatStreamEvent>,
): Response {
  const stop = new AbortController();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (!cancelled) controller.enqueue(encodeChatEvent(event));
      };
      void (async () => {
        try {
          for await (const event of events(stop)) send(event);
        } catch (error) {
          logger.error("ai chat stream failed", { error });
          send({
            type: "replace",
            key: INPUT_MESSAGE_KEYS.failedClosed,
            text: deps.translate(INPUT_MESSAGE_KEYS.failedClosed),
            href: FALLBACK_HREF,
          });
          send({ type: "done", outcome: "error" });
        } finally {
          if (!cancelled) controller.close();
        }
      })();
    },
    cancel() {
      cancelled = true;
      stop.abort();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "x-request-id": requestId,
    },
  });
}
