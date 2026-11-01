import { ActionError } from "../actions/normalise-error";
import { databaseScope, RATE_LIMITS, type RateLimitRule, type RateLimitScope } from "./limits";

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
  hashKey(key: string): string;
}

function subjectFor(rule: RateLimitRule, caller: RateLimitCaller, key: string | undefined): string {
  switch (rule.who) {
    case "visitor":
      return caller.visitor();
    case "ip":
      return caller.ip();
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
  for (const rule of RATE_LIMITS[parameters.scope]) {
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
