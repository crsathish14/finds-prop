import "server-only";
import { cookies, headers } from "next/headers";
import { env } from "../env";
import { ActionError } from "../actions/normalise-error";
import type { SessionView } from "../auth/session";
import { createAdminSupabase } from "../supabase/admin.server";
import { ensureAnonymousId, readAnonymousId, type AnonymousIdCookieJar } from "./anonymous-id";
import {
  enforceRateLimit,
  RateLimitedError,
  type RateLimitCaller,
  type RateLimitCounter,
} from "./enforce";
import { AI_CHAT_RATE_LIMIT_SCOPES, type RateLimitScope } from "./limits";

import { clientIp, hashValue, networkAddress, visitorHash } from "./visitor-hash";

/** One of the five limits of the AI chat. */
export type AiChatRateLimitScope = (typeof AI_CHAT_RATE_LIMIT_SCOPES)[number];

/** The database counter, reached with the service role (public_rate_limits is closed to users). */
export function createRateLimitCounter(requestId: string): RateLimitCounter {
  const client = createAdminSupabase(requestId);
  return {
    async hit(scope, subject, windowSeconds, maxHits) {
      const { data, error } = await client.rpc("rate_limit_hit", {
        limit_scope: scope,
        limit_subject: subject,
        window_seconds: windowSeconds,
        max_hits: maxHits,
      });
      const answer = data?.[0];
      if (error || !answer) {
        throw new ActionError("INTERNAL", "The rate limit counter did not answer");
      }
      return { allowed: answer.allowed, retryAfter: answer.retry_after };
    },
  };
}

/** The constant key of the platform-wide limit: every caller counts under it. */
const GLOBAL_KEY = "global_day";

/** Who is calling, from the request's headers and, for the AI chat, the anonymous cookie id. */
function callerFor(parameters: {
  session: SessionView | null;
  address: string;
  userAgent: string;
  anonymousId: string | null;
}): RateLimitCaller {
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  return {
    userId: parameters.session?.userId ?? null,
    visitor: () => visitorHash(secret, parameters.address, parameters.userAgent),
    ip: () => hashValue(secret, parameters.address),
    network: () => hashValue(secret, networkAddress(parameters.address)),
    global: () => hashValue(secret, GLOBAL_KEY),
    // The id is hashed, like an address, so the database never holds a value a browser sent.
    cookie: () =>
      parameters.anonymousId === null
        ? null
        : hashValue(secret, "ai_cookie", parameters.anonymousId),
    hashKey: (key) => hashValue(secret, key),
  };
}

/** The rate limit step of defineAction (step 4). */
export async function enforceActionRateLimit(parameters: {
  scope: RateLimitScope;
  session: SessionView | null;
  key?: string;
  requestId: string;
}): Promise<void> {
  const incoming = await headers();
  await enforceRateLimit({
    counter: createRateLimitCounter(parameters.requestId),
    scope: parameters.scope,
    caller: callerFor({
      session: parameters.session,
      address: clientIp(incoming, env.APP_ENV !== "local"),
      userAgent: incoming.get("user-agent") ?? "",
      anonymousId: null,
    }),
    ...(parameters.key !== undefined ? { key: parameters.key } : {}),
  });
}

/**
 * Counts one attempt against a scope whose rule counts by a key the code names, for work that runs after a request
 * has been answered (the enquiry mails, ADR-188): there is no caller to count, only the key, which is hashed before
 * it is stored. Answers true when the attempt is within the limit and false when the limit is used up. A counter or a
 * secret that fails throws (fail closed), so the caller decides what to do; the mail code skips the mail.
 */
export async function hitKeyedRateLimit(parameters: {
  scope: RateLimitScope;
  key: string;
  requestId: string;
}): Promise<boolean> {
  try {
    await enforceRateLimit({
      counter: createRateLimitCounter(parameters.requestId),
      scope: parameters.scope,
      caller: callerFor({ session: null, address: "", userAgent: "", anonymousId: null }),
      key: parameters.key,
    });
    return true;
  } catch (error) {
    if (error instanceof RateLimitedError) return false;
    throw error;
  }
}

/**
 * The browser's anonymous cookie id, made and set on the response if it has none. If the cookie cannot be set
 * (a read-only context) the id is NOT used: a fresh random id on every request would hand out a new trial each
 * time, so the caller falls back to the visitor hash instead.
 */
function anonymousIdFor(jar: AnonymousIdCookieJar): string | null {
  try {
    return ensureAnonymousId(jar, { secure: env.APP_ENV !== "local" }).id;
  } catch {
    return readAnonymousId(jar);
  }
}

/**
 * Counts one chat message against every AI chat limit, in order (the endpoint calls this once per message,
 * ADR-128 section 7.1). Refused with RATE_LIMITED and the seconds to wait by the first limit that is used up;
 * refused with INTERNAL if the counter or the hash secret fails (fail closed). A signed-in caller is counted by
 * user id and never gets a cookie; an anonymous one gets the cookie id on their first message. The refusal is a
 * `RateLimitedError`, which names the scope that refused. `scopes` narrows the list (kept in the same order): a
 * message the input check refused without a model call counts toward fewer limits (ADR-128 section 6.4.1).
 */
export async function enforceAiChatRateLimits(parameters: {
  session: SessionView | null;
  requestId: string;
  scopes?: readonly AiChatRateLimitScope[];
}): Promise<void> {
  const incoming = await headers();
  const anonymousId = parameters.session === null ? anonymousIdFor(await cookies()) : null;
  const caller = callerFor({
    session: parameters.session,
    address: clientIp(incoming, env.APP_ENV !== "local"),
    userAgent: incoming.get("user-agent") ?? "",
    anonymousId,
  });
  const counter = createRateLimitCounter(parameters.requestId);
  const wanted = parameters.scopes ?? AI_CHAT_RATE_LIMIT_SCOPES;
  for (const scope of AI_CHAT_RATE_LIMIT_SCOPES) {
    if (wanted.includes(scope)) await enforceRateLimit({ counter, scope, caller });
  }
}

/**
 * The visitor hash of a request, for the usage row of the AI chat (ADR-128 section 8): the same HMAC of the address and
 * the browser that counts an anonymous caller, never the address. `null` when the secret is not set (the row is then
 * written without it), so a missing secret never costs a customer their answer.
 */
export function requestVisitorHash(incoming: Pick<Headers, "get">): string | null {
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  if (!secret) return null;
  return visitorHash(
    secret,
    clientIp(incoming, env.APP_ENV !== "local"),
    incoming.get("user-agent") ?? "",
  );
}
