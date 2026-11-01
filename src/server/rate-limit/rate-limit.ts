import "server-only";
import { headers } from "next/headers";
import { env } from "../env";
import { ActionError } from "../actions/normalise-error";
import type { SessionView } from "../auth/session";
import { createAdminSupabase } from "../supabase/admin.server";
import { enforceRateLimit, type RateLimitCounter } from "./enforce";
import type { RateLimitScope } from "./limits";
import { clientIp, hashValue, visitorHash } from "./visitor-hash";

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

/** The rate limit step of defineAction (step 4). */
export async function enforceActionRateLimit(parameters: {
  scope: RateLimitScope;
  session: SessionView | null;
  key?: string;
  requestId: string;
}): Promise<void> {
  const incoming = await headers();
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  const address = clientIp(incoming, env.APP_ENV !== "local");
  const userAgent = incoming.get("user-agent") ?? "";
  await enforceRateLimit({
    counter: createRateLimitCounter(parameters.requestId),
    scope: parameters.scope,
    caller: {
      userId: parameters.session?.userId ?? null,
      visitor: () => visitorHash(secret, address, userAgent),
      ip: () => hashValue(secret, address),
      hashKey: (key) => hashValue(secret, key),
    },
    ...(parameters.key !== undefined ? { key: parameters.key } : {}),
  });
}
