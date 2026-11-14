import { AI_TRIAL_MESSAGES } from "@/config/ai";
import type { Translate } from "@/lib/format";
import type { AiChatRateLimitScope } from "@/server/rate-limit/rate-limit";
import type { ErrorCode } from "@/types/action";

/**
 * The answers the endpoint gives before a stream starts: a plain 404, and a small JSON failure for everything that
 * stops the message (a bad request, a limit, a fault). The same shape every time, so the page reads one thing:
 *
 *   { "error": { "code", "state"?, "title"?, "message"?, "retryAfter"? }, "requestId" }
 *
 * `code` is from the closed set (`ErrorCode`). `state` names the screen the chat shows (ADR-128 section 10; UX
 * addendum decision 7): `sign_in_required` is the gate after the free messages, `too_many_messages` the short wait,
 * `daily_limit` the "try again tomorrow", `unavailable` the budget for the whole day. `title` and `message` are the
 * approved fixed wording from `en.json`, already turned into text. Nothing here carries a database message, a stack,
 * a provider's words or a number the customer did not already know.
 */

type ChatFailureState =
  "sign_in_required" | "too_many_messages" | "daily_limit" | "unavailable" | "error";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The flag is off: the endpoint does not exist (the kill switch of ADR-128 section 7). */
export function notFoundResponse(): Response {
  return new Response(null, { status: 404, headers: NO_STORE });
}

interface Failure {
  readonly status: number;
  readonly code: ErrorCode;
  readonly requestId: string;
  readonly state?: ChatFailureState;
  readonly title?: string;
  readonly message?: string;
  readonly retryAfter?: number;
}

function failureResponse(failure: Failure): Response {
  const headers: Record<string, string> = { ...NO_STORE, "x-request-id": failure.requestId };
  if (failure.retryAfter !== undefined) headers["Retry-After"] = String(failure.retryAfter);
  const error = {
    code: failure.code,
    ...(failure.state === undefined ? {} : { state: failure.state }),
    ...(failure.title === undefined ? {} : { title: failure.title }),
    ...(failure.message === undefined ? {} : { message: failure.message }),
    ...(failure.retryAfter === undefined ? {} : { retryAfter: failure.retryAfter }),
  };
  return Response.json(
    { error, requestId: failure.requestId },
    { status: failure.status, headers },
  );
}

/** The request is not one this endpoint accepts: not JSON, too large, a message of another shape, a wrong origin. */
export function invalidRequestResponse(status: 400 | 403 | 413 | 415, requestId: string): Response {
  const code: ErrorCode = status === 403 ? "FORBIDDEN" : "VALIDATION";
  return failureResponse({ status, code, requestId });
}

/** The message could not be handled for a reason on our side. The customer may try again. */
export function serverErrorResponse(requestId: string, translate: Translate): Response {
  return failureResponse({
    status: 500,
    code: "INTERNAL",
    requestId,
    state: "error",
    title: translate("ai.errorTitle"),
    message: translate("ai.errorBody"),
  });
}

/**
 * The screen for the limit that refused. The free trial gets the sign-in gate (and no wait: it lasts a year); the
 * short limit gets the wait in seconds; the signed-in day and the address backstop share the "tomorrow" screen; only
 * the budget of the whole platform says the assistant is unavailable.
 */
export function limitResponse(
  scope: AiChatRateLimitScope,
  retryAfter: number | undefined,
  requestId: string,
  translate: Translate,
): Response {
  const seconds = Math.max(1, Math.ceil(retryAfter ?? 1));
  switch (scope) {
    case "ai_chat_trial":
      return failureResponse({
        status: 401,
        code: "UNAUTHENTICATED",
        requestId,
        state: "sign_in_required",
        title: translate("ai.signInGateTitle"),
        message: translate("ai.signInGateBody", { count: AI_TRIAL_MESSAGES }),
      });
    case "ai_chat_burst":
      return failureResponse({
        status: 429,
        code: "RATE_LIMITED",
        requestId,
        state: "too_many_messages",
        title: translate("ai.tooManyMessagesTitle"),
        message: translate("ai.tooManyMessagesBody", { seconds }),
        retryAfter: seconds,
      });
    case "ai_chat_trial_ip":
    case "ai_chat_user_day":
      return failureResponse({
        status: 429,
        code: "RATE_LIMITED",
        requestId,
        state: "daily_limit",
        title: translate("ai.dailyLimitTitle"),
        message: translate("ai.dailyLimitBody"),
        retryAfter: seconds,
      });
    case "ai_chat_global_day":
      return failureResponse({
        status: 429,
        code: "RATE_LIMITED",
        requestId,
        state: "unavailable",
        title: translate("ai.unavailableTitle"),
        message: translate("ai.unavailableBody"),
        retryAfter: seconds,
      });
  }
}
