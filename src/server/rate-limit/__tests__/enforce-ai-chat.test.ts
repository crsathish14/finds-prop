import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  enforceRateLimit,
  type RateLimitCaller,
  type RateLimitCounter,
} from "@/server/rate-limit/enforce";
import { AI_CHAT_RATE_LIMIT_SCOPES, type RateLimitScope } from "@/server/rate-limit/limits";

function counterThatAllows(allowed = true, retryAfter = 0) {
  const hit = vi.fn().mockResolvedValue({ allowed, retryAfter });
  return { counter: { hit } satisfies RateLimitCounter, hit };
}

const signedIn: RateLimitCaller = {
  userId: "user-1",
  visitor: () => "visitor-hash",
  ip: () => "ip-hash",
  network: () => "network-hash",
  global: () => "global-hash",
  cookie: () => "cookie-hash",
  hashKey: (key) => `hashed(${key})`,
};
const anonymous: RateLimitCaller = { ...signedIn, userId: null };
const anonymousWithoutCookie: RateLimitCaller = { ...anonymous, cookie: () => null };

async function failure(run: Promise<void>): Promise<ActionError> {
  try {
    await run;
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

const YEAR_WINDOW = 366 * 24 * 60 * 60;

describe("UT-rate-limit-ai: each rule of the AI chat (ADR-128 section 7, D9, D13)", () => {
  it("UT-ai-trial: 2 messages over 366 days, counted by the cookie id, under the scope the database keeps for a year", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: anonymous });
    expect(hit).toHaveBeenCalledWith("ai_chat_trial_cookie", "cookie-hash", YEAR_WINDOW, 2);
  });

  it("UT-ai-trial-fallback: a browser that sends no cookie is counted by its visitor hash, under its own scope", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: anonymousWithoutCookie });
    expect(hit).toHaveBeenCalledWith("ai_chat_trial_visitor", "visitor-hash", YEAR_WINDOW, 2);
  });

  it("UT-ai-trial-ip: 40 anonymous messages a day, counted by the network hash and not by the plain address hash", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_trial_ip", caller: anonymous });
    expect(hit).toHaveBeenCalledWith("ai_chat_trial_ip_network", "network-hash", 86400, 40);
  });

  it("UT-ai-burst-anonymous: 10 a minute, by the cookie id, else the visitor hash", async () => {
    const withCookie = counterThatAllows();
    await enforceRateLimit({
      counter: withCookie.counter,
      scope: "ai_chat_burst",
      caller: anonymous,
    });
    expect(withCookie.hit).toHaveBeenCalledWith("ai_chat_burst_cookie", "cookie-hash", 60, 10);
    const without = counterThatAllows();
    await enforceRateLimit({
      counter: without.counter,
      scope: "ai_chat_burst",
      caller: anonymousWithoutCookie,
    });
    expect(without.hit).toHaveBeenCalledWith("ai_chat_burst_visitor", "visitor-hash", 60, 10);
  });

  it("UT-ai-burst-signed-in: 10 a minute, by the user id, whatever cookie the browser holds", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_burst", caller: signedIn });
    expect(hit).toHaveBeenCalledWith("ai_chat_burst_user", "user-1", 60, 10);
  });

  it("UT-ai-user-day: 40 a day, by the user id", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_user_day", caller: signedIn });
    expect(hit).toHaveBeenCalledWith("ai_chat_user_day_user", "user-1", 86400, 40);
  });

  it("UT-ai-global-day: every caller counts under one constant key, whoever they are", async () => {
    const first = counterThatAllows();
    await enforceRateLimit({
      counter: first.counter,
      scope: "ai_chat_global_day",
      caller: signedIn,
    });
    const second = counterThatAllows();
    const stranger: RateLimitCaller = {
      ...anonymous,
      visitor: () => "someone-else",
      cookie: () => "another-cookie",
    };
    await enforceRateLimit({
      counter: second.counter,
      scope: "ai_chat_global_day",
      caller: stranger,
    });
    expect(first.hit.mock.calls[0]).toEqual([
      "ai_chat_global_day_global",
      "global-hash",
      86400,
      1000,
    ]);
    expect(second.hit.mock.calls[0]).toEqual(first.hit.mock.calls[0]);
  });

  it("UT-ai-order: counts the short limits first and the global budget last", () => {
    expect([...AI_CHAT_RATE_LIMIT_SCOPES]).toEqual([
      "ai_chat_burst",
      "ai_chat_trial",
      "ai_chat_trial_ip",
      "ai_chat_user_day",
      "ai_chat_global_day",
    ]);
  });
});

describe("UT-rate-limit-ai: who is counted when", () => {
  it("UT-ai-moving-to-a-user: an anonymous caller who signs in leaves the trial behind and starts on the signed-in allowance", async () => {
    const before = counterThatAllows();
    for (const scope of ["ai_chat_trial", "ai_chat_trial_ip", "ai_chat_burst"] as const) {
      await enforceRateLimit({ counter: before.counter, scope, caller: anonymous });
    }
    expect(before.hit.mock.calls.map((call) => call[0])).toEqual([
      "ai_chat_trial_cookie",
      "ai_chat_trial_ip_network",
      "ai_chat_burst_cookie",
    ]);

    // The same browser, now signed in, still sends the same cookie. Nothing is counted by it any more.
    const after = counterThatAllows();
    for (const scope of AI_CHAT_RATE_LIMIT_SCOPES) {
      await enforceRateLimit({ counter: after.counter, scope, caller: signedIn });
    }
    expect(after.hit.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ["ai_chat_burst_user", "user-1"],
      ["ai_chat_user_day_user", "user-1"],
      ["ai_chat_global_day_global", "global-hash"],
    ]);
  });

  it("UT-ai-anonymous-skips-the-signed-in-day: the signed-in daily allowance is not counted for an anonymous caller", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "ai_chat_user_day", caller: anonymous });
    expect(hit).not.toHaveBeenCalled();
  });

  it("UT-ai-shared-ip: two browsers behind one address each get their own trial and share only the loose address cap", async () => {
    const calls: Array<[string, string]> = [];
    const counter: RateLimitCounter = {
      hit: (scope, subject) => {
        calls.push([scope, subject]);
        return Promise.resolve({ allowed: true, retryAfter: 0 });
      },
    };
    const first: RateLimitCaller = { ...anonymous, cookie: () => "cookie-of-a" };
    const second: RateLimitCaller = { ...anonymous, cookie: () => "cookie-of-b" };
    for (const person of [first, second]) {
      await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: person });
      await enforceRateLimit({ counter, scope: "ai_chat_trial_ip", caller: person });
    }
    expect(calls).toEqual([
      ["ai_chat_trial_cookie", "cookie-of-a"],
      ["ai_chat_trial_ip_network", "network-hash"],
      ["ai_chat_trial_cookie", "cookie-of-b"],
      ["ai_chat_trial_ip_network", "network-hash"],
    ]);
  });

  it("UT-ai-user-and-visitor-never-mix: a user id is never counted under a visitor or cookie scope", async () => {
    const { counter, hit } = counterThatAllows();
    for (const scope of AI_CHAT_RATE_LIMIT_SCOPES) {
      await enforceRateLimit({ counter, scope, caller: signedIn });
    }
    for (const call of hit.mock.calls) {
      const scope = String(call[0]);
      if (call[1] === "user-1") expect(scope).toMatch(/_user$/);
      else expect(scope).not.toMatch(/_user$/);
    }
  });
});

const SCOPES_FOR_ANONYMOUS: readonly RateLimitScope[] = [
  "ai_chat_trial",
  "ai_chat_trial_ip",
  "ai_chat_burst",
  "ai_chat_global_day",
];
const SCOPES_FOR_SIGNED_IN: readonly RateLimitScope[] = [
  "ai_chat_burst",
  "ai_chat_user_day",
  "ai_chat_global_day",
];

describe("UT-rate-limit-ai: refusals", () => {
  it.each(SCOPES_FOR_ANONYMOUS)(
    "UT-ai-refused-anonymous-%s: RATE_LIMITED with the seconds to wait when used up",
    async (scope) => {
      const { counter } = counterThatAllows(false, 321);
      const refusal = await failure(enforceRateLimit({ counter, scope, caller: anonymous }));
      expect(refusal.code).toBe("RATE_LIMITED");
      expect(refusal.retryAfter).toBe(321);
    },
  );

  it.each(SCOPES_FOR_SIGNED_IN)(
    "UT-ai-refused-signed-in-%s: RATE_LIMITED with the seconds to wait when used up",
    async (scope) => {
      const { counter } = counterThatAllows(false, 654);
      const refusal = await failure(enforceRateLimit({ counter, scope, caller: signedIn }));
      expect(refusal.code).toBe("RATE_LIMITED");
      expect(refusal.retryAfter).toBe(654);
    },
  );

  it.each(SCOPES_FOR_ANONYMOUS)(
    "UT-ai-fail-closed-anonymous-%s: refused, never let through, when the counter fails",
    async (scope) => {
      const hit = vi.fn().mockRejectedValue(new ActionError("INTERNAL", "counter down"));
      const refusal = await failure(
        enforceRateLimit({ counter: { hit }, scope, caller: anonymous }),
      );
      expect(refusal.code).toBe("INTERNAL");
    },
  );

  it.each(SCOPES_FOR_SIGNED_IN)(
    "UT-ai-fail-closed-signed-in-%s: refused, never let through, when the counter fails",
    async (scope) => {
      const hit = vi.fn().mockRejectedValue(new ActionError("INTERNAL", "counter down"));
      const refusal = await failure(
        enforceRateLimit({ counter: { hit }, scope, caller: signedIn }),
      );
      expect(refusal.code).toBe("INTERNAL");
    },
  );

  it("UT-ai-fail-closed-secret: refused before anything is counted when the hash secret is missing", async () => {
    const { counter, hit } = counterThatAllows();
    const secretless: RateLimitCaller = {
      ...anonymous,
      cookie: () => {
        throw new ActionError("INTERNAL", "RATE_LIMIT_HMAC_SECRET is not configured");
      },
    };
    const refusal = await failure(
      enforceRateLimit({ counter, scope: "ai_chat_trial", caller: secretless }),
    );
    expect(refusal.code).toBe("INTERNAL");
    expect(hit).not.toHaveBeenCalled();
  });

  it("UT-ai-stops-at-the-first-refusal: a later limit is not spent by a message an earlier one refused", async () => {
    const hit = vi
      .fn()
      .mockResolvedValueOnce({ allowed: false, retryAfter: 30 })
      .mockResolvedValue({ allowed: true, retryAfter: 0 });
    await failure(
      (async () => {
        for (const scope of AI_CHAT_RATE_LIMIT_SCOPES) {
          await enforceRateLimit({ counter: { hit }, scope, caller: anonymous });
        }
      })(),
    );
    expect(hit).toHaveBeenCalledTimes(1);
  });
});
