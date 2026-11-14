import { ActionError } from "../actions/normalise-error";
import {
  databaseScope,
  RATE_LIMITS,
  type RateLimitRule,
  type RateLimitScope,
  type RateLimitWho,
} from "./limits";

/** One call to the database counter: the answer for one attempt. */
export interface RateLimitCounter {
  hit(
    scope: string,
    subject: string,
    windowSeconds: number,
    maxHits: number,
  ): Promise<{ allowed: boolean; retryAfter: number }>;
}

/**
 * Who is calling. The hashes are computed only when a rule needs them, so a limit counted by user
 * id never needs the hash secret.
 */
export interface RateLimitCaller {
  userId: string | null;
  visitor(): string;
  ip(): string;
  /** The address like `ip()`, but an IPv6 address is cut to its /64 prefix first. */
  network(): string;
  /** The one constant key shared by every caller, for a limit on the whole platform. */
  global(): string;
  /** The hash of the anonymous cookie id, or null when the browser sent none. */
  cookie(): string | null;
  hashKey(key: string): string;
}

function isAvailable(who: RateLimitWho, caller: RateLimitCaller): boolean {
  if (who === "user") return caller.userId !== null;
  if (who === "cookie") return caller.cookie() !== null;
  return true;
}

/**
 * The rule as it applies to this caller: `who` when that exists for them, else the first of `otherwise`
 * that does. The counts of different kinds of caller never mix, because the database scope follows the
 * "who" used. If none exists the rule is returned unchanged and `subjectFor` refuses it.
 */
function effectiveRule(rule: RateLimitRule, caller: RateLimitCaller): RateLimitRule {
  for (const who of [rule.who, ...(rule.otherwise ?? [])]) {
    if (isAvailable(who, caller)) return { ...rule, who };
  }
  return rule;
}

function appliesTo(rule: RateLimitRule, caller: RateLimitCaller): boolean {
  if (rule.only === "anonymous") return caller.userId === null;
  if (rule.only === "signed_in") return caller.userId !== null;
  return true;
}

function subjectFor(rule: RateLimitRule, caller: RateLimitCaller, key: string | undefined): string {
  switch (rule.who) {
    case "visitor":
      return caller.visitor();
    case "ip":
      return caller.ip();
    case "network":
      return caller.network();
    case "global":
      return caller.global();
    case "cookie": {
      const cookie = caller.cookie();
      if (cookie === null)
        throw new ActionError("INTERNAL", "A per-cookie limit needs a cookie id");
      return cookie;
    }
    case "user":
      if (!caller.userId)
        throw new ActionError("INTERNAL", "A per-user limit needs a signed-in user");
      return caller.userId;
    case "key":
      if (key === undefined) throw new ActionError("INTERNAL", "This limit needs a key");
      return caller.hashKey(key);
    case "visitor_key":
      if (key === undefined) throw new ActionError("INTERNAL", "This limit needs a key");
      return `${caller.visitor()}:${caller.hashKey(key)}`;
  }
}

/**
 * Counts one attempt against every rule of the scope, in order. The first rule that is over its
 * limit refuses the call with RATE_LIMITED and the seconds to wait. If the counter itself fails the
 * call is refused too (fail closed): an unprotected anonymous action is worse than a retry.
 */
export async function enforceRateLimit(parameters: {
  counter: RateLimitCounter;
  scope: RateLimitScope;
  caller: RateLimitCaller;
  key?: string;
}): Promise<void> {
  for (const configured of RATE_LIMITS[parameters.scope] as readonly RateLimitRule[]) {
    if (!appliesTo(configured, parameters.caller)) continue;
    const rule = effectiveRule(configured, parameters.caller);
    const subject = subjectFor(rule, parameters.caller, parameters.key);
    const answer = await parameters.counter.hit(
      databaseScope(parameters.scope, rule),
      subject,
      rule.windowSeconds,
      rule.max,
    );
    if (!answer.allowed) {
      throw new ActionError("RATE_LIMITED", `Rate limit reached for ${parameters.scope}`, {
        retryAfter: answer.retryAfter,
      });
    }
  }
}
