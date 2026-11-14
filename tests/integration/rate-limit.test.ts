import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { enforceRateLimit, type RateLimitCaller } from "@/server/rate-limit/enforce";
import { createRateLimitCounter, enforceActionRateLimit } from "@/server/rate-limit/rate-limit";
import type { SessionView } from "@/server/auth/session";
import { adminClient, visitorClient } from "./support/clients";

const request = vi.hoisted(() => ({ userAgent: "" }));

// Outside a request there is no header store, so the tests stand in for the browser's headers.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": request.userAgent }),
}));

const SCOPE = "it_rate_limit";
const subjects: string[] = [];

function newSubject(): string {
  const subject = `it-${randomUUID()}`;
  subjects.push(subject);
  return subject;
}

function sessionFor(userId: string): SessionView {
  return { userId, roles: ["customer"], phoneVerified: true, builderId: null };
}

async function refusal(attempt: Promise<void>): Promise<ActionError> {
  const error = await attempt.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ActionError);
  return error as ActionError;
}

afterAll(async () => {
  await adminClient().from("public_rate_limits").delete().in("subject_hash", subjects);
});

describe("IT-rate-limit: the database counter (rate_limit_hit)", () => {
  const counter = createRateLimitCounter(randomUUID());

  it("allows up to the maximum, then refuses with the seconds to wait", async () => {
    const subject = newSubject();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(await counter.hit(SCOPE, subject, 3600, 3)).toEqual({ allowed: true, retryAfter: 0 });
    }
    const over = await counter.hit(SCOPE, subject, 3600, 3);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThanOrEqual(1);
    expect(over.retryAfter).toBeLessThanOrEqual(3600);
  });

  it("counts each subject and each scope on its own", async () => {
    const first = newSubject();
    const second = newSubject();
    expect((await counter.hit(SCOPE, first, 3600, 1)).allowed).toBe(true);
    expect((await counter.hit(SCOPE, first, 3600, 1)).allowed).toBe(false);
    expect((await counter.hit(SCOPE, second, 3600, 1)).allowed).toBe(true);
    expect((await counter.hit(`${SCOPE}_other`, first, 3600, 1)).allowed).toBe(true);
  });

  it("lets two requests at the same time use up exactly the allowance", async () => {
    const subject = newSubject();
    const answers = await Promise.all(
      Array.from({ length: 10 }, () => counter.hit(SCOPE, subject, 3600, 4)),
    );
    expect(answers.filter((answer) => answer.allowed)).toHaveLength(4);
  });

  it("refuses nonsense windows and limits", async () => {
    await expect(counter.hit(SCOPE, newSubject(), 0, 3)).rejects.toMatchObject({
      code: "INTERNAL",
    });
    await expect(counter.hit(SCOPE, newSubject(), 60, 0)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("is closed to anyone but the service (a visitor cannot spend another person's allowance)", async () => {
    const { error } = await visitorClient().rpc("rate_limit_hit", {
      limit_scope: SCOPE,
      limit_subject: newSubject(),
      window_seconds: 60,
      max_hits: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe("IT-rate-limit: the rules of a scope", () => {
  it("refuses the eleventh enquiry of one user in a day with RATE_LIMITED and a retry time", async () => {
    const userId = randomUUID();
    subjects.push(userId);
    const counter = createRateLimitCounter(randomUUID());
    const caller = {
      userId,
      visitor: () => "unused-visitor-hash",
      ip: () => "unused-ip-hash",
      network: () => "unused-network-hash",
      global: () => "unused-global-hash",
      cookie: () => null,
      hashKey: () => "unused-key-hash",
    };
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await enforceRateLimit({ counter, scope: "enquiry", caller });
    }
    const error = await refusal(enforceRateLimit({ counter, scope: "enquiry", caller }));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("IT-rate-limit: the action step (hashes from the request, secret from the environment)", () => {
  it("counts one visitor, told apart by browser, and leaves other visitors alone", async () => {
    request.userAgent = `it-browser-${randomUUID()}`;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      await enforceActionRateLimit({
        scope: "project_event",
        session: null,
        requestId: randomUUID(),
      });
    }
    const error = await refusal(
      enforceActionRateLimit({ scope: "project_event", session: null, requestId: randomUUID() }),
    );
    expect(error.code).toBe("RATE_LIMITED");

    request.userAgent = `it-browser-${randomUUID()}`;
    await enforceActionRateLimit({
      scope: "project_event",
      session: null,
      requestId: randomUUID(),
    });
  });

  it("counts a signed-in user by id, whichever browser they use", async () => {
    const userId = randomUUID();
    subjects.push(userId);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      request.userAgent = `it-browser-${attempt}`;
      await enforceActionRateLimit({
        scope: "enquiry",
        session: sessionFor(userId),
        requestId: randomUUID(),
      });
    }
    request.userAgent = "it-browser-another";
    const error = await refusal(
      enforceActionRateLimit({
        scope: "enquiry",
        session: sessionFor(userId),
        requestId: randomUUID(),
      }),
    );
    expect(error.code).toBe("RATE_LIMITED");
  });
});

/** A caller of the AI chat with fresh identities, so a rerun on the same database never meets old counts. */
function aiCaller(who: {
  userId?: string | null;
  cookie?: string | null;
  network?: string;
}): RateLimitCaller {
  const visitor = `it-visitor-${randomUUID()}`;
  const cookie = who.cookie === undefined ? `it-cookie-${randomUUID()}` : who.cookie;
  const network = who.network ?? `it-network-${randomUUID()}`;
  const globalKey = `it-global-${randomUUID()}`;
  subjects.push(visitor, network, globalKey);
  if (cookie) subjects.push(cookie);
  if (who.userId) subjects.push(who.userId);
  return {
    userId: who.userId ?? null,
    visitor: () => visitor,
    ip: () => `it-ip-${network}`,
    network: () => network,
    global: () => globalKey,
    cookie: () => cookie,
    hashKey: (key) => key,
  };
}

describe("IT-rate-limit-ai: the AI chat rules against a real database (ADR-128 section 7, D9, D13)", () => {
  const counter = createRateLimitCounter(randomUUID());

  it("IT-ai-trial: allows 2 messages over a year, then refuses with a retry time of more than a day", async () => {
    const caller = aiCaller({});
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller });
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller });
    const error = await refusal(enforceRateLimit({ counter, scope: "ai_chat_trial", caller }));
    expect(error.code).toBe("RATE_LIMITED");
    // A day-long window would answer at most 86,400: this proves the one-year window (migration 20261114120000).
    expect(error.retryAfter).toBeGreaterThan(86400);
    expect(error.retryAfter).toBeLessThanOrEqual(366 * 86400);
  });

  it("IT-ai-trial-fallback: a browser with no cookie is counted by its visitor hash", async () => {
    const caller = aiCaller({ cookie: null });
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller });
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller });
    const error = await refusal(enforceRateLimit({ counter, scope: "ai_chat_trial", caller }));
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("IT-ai-shared-ip: two browsers behind one address each get 2 messages; the address cap is 40 a day and loose", async () => {
    const network = `it-shared-${randomUUID()}`;
    const first = aiCaller({ network });
    const second = aiCaller({ network });
    for (const person of [first, second]) {
      await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: person });
      await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: person });
    }
    // 4 messages so far from this address; the cap refuses the 41st, not the 5th.
    for (let message = 1; message <= 40; message += 1) {
      await enforceRateLimit({ counter, scope: "ai_chat_trial_ip", caller: first });
    }
    const error = await refusal(
      enforceRateLimit({ counter, scope: "ai_chat_trial_ip", caller: second }),
    );
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("IT-ai-moving-to-a-user: after the trial is used up, signing in starts the signed-in allowance", async () => {
    const cookie = `it-cookie-${randomUUID()}`;
    const anonymous = aiCaller({ cookie });
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: anonymous });
    await enforceRateLimit({ counter, scope: "ai_chat_trial", caller: anonymous });
    await refusal(enforceRateLimit({ counter, scope: "ai_chat_trial", caller: anonymous }));

    const signedIn = aiCaller({ cookie, userId: randomUUID() });
    for (const scope of ["ai_chat_trial", "ai_chat_burst", "ai_chat_user_day"] as const) {
      await enforceRateLimit({ counter, scope, caller: signedIn });
    }
  });

  it("IT-ai-burst: allows 10 messages a minute, then refuses the 11th", async () => {
    const caller = aiCaller({ userId: randomUUID() });
    for (let message = 1; message <= 10; message += 1) {
      await enforceRateLimit({ counter, scope: "ai_chat_burst", caller });
    }
    const error = await refusal(enforceRateLimit({ counter, scope: "ai_chat_burst", caller }));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfter).toBeLessThanOrEqual(60);
  });

  it("IT-ai-user-day: allows 40 messages a day to a signed-in customer, then refuses the 41st", async () => {
    const caller = aiCaller({ userId: randomUUID() });
    for (let message = 1; message <= 40; message += 1) {
      await enforceRateLimit({ counter, scope: "ai_chat_user_day", caller });
    }
    const error = await refusal(enforceRateLimit({ counter, scope: "ai_chat_user_day", caller }));
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("IT-ai-global-day: counts under one constant key and passes while the budget lasts", async () => {
    const caller = aiCaller({});
    await enforceRateLimit({ counter, scope: "ai_chat_global_day", caller });
    const answer = await counter.hit("ai_chat_global_day_global", caller.global(), 86400, 1);
    expect(answer.allowed).toBe(false);
  });
});
