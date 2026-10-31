import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLogger } from "@/server/logger";
import {
  createDefineAction,
  failClosedDeps,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError, classifyError, toFailure } from "@/server/actions/normalise-error";

const user: SessionView = { userId: "u1", roles: ["customer"], aal: "aal1" };
const admin: SessionView = { userId: "a1", roles: ["super_admin"], aal: "aal2" };

function harness(overrides: Partial<ActionDeps> = {}, session: SessionView | null = user) {
  const calls: string[] = [];
  const lines: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: (scope) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
    },
    beginIdempotent: (key) => {
      calls.push(`idempotency:${key}`);
      return Promise.resolve({ replay: false });
    },
    completeIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join(",")}`);
    },
    audit: ({ action }) => {
      calls.push(`audit:${action}`);
      return Promise.resolve();
    },
    log: createLogger({}, { write: (line) => lines.push(line) }),
    ...overrides,
  };
  return { defineAction: createDefineAction(deps), calls, lines };
}

const input = z.object({ id: z.uuid(), idempotencyKey: z.string().default("k1") });
const validInput = { id: "2f1b9a54-0c6e-4a3d-9a61-5d3f0b8e7c11" };

describe("UT-define-action: pipeline order (R-BE-02)", () => {
  it("runs parse, authenticate, authorise, rate limit, idempotency, handler, invalidate, audit in that order", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({
      name: "markSold",
      input,
      auth: "user",
      rateLimit: { scope: "listing" },
      idempotencyKey: (i) => i.idempotencyKey,
      invalidate: () => ["property:1"],
      audit: { action: "listing.sold" },
      handler: () => {
        calls.push("handler");
        return Promise.resolve({ done: true });
      },
    });
    const result = await action(validInput);
    expect(result).toEqual({ ok: true, data: { done: true } });
    expect(calls).toEqual([
      "authenticate",
      "rateLimit:listing",
      "idempotency:k1",
      "handler",
      "invalidate:property:1",
      "audit:listing.sold",
    ]);
  });

  it("does not run the handler when validation fails and reports field errors", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.resolve(1),
    });
    const result = await action({ id: "not-a-uuid" });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result.ok === false && result.fieldErrors?.id?.length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("accepts FormData and turns repeated keys into arrays", async () => {
    const { defineAction } = harness();
    const action = defineAction({
      name: "x",
      input: z.object({ tag: z.array(z.string()) }),
      auth: "none",
      handler: ({ input: i }) => Promise.resolve(i.tag),
    });
    const form = new FormData();
    form.append("tag", "a");
    form.append("tag", "b");
    expect(await action(form)).toEqual({ ok: true, data: ["a", "b"] });
  });
});

describe("UT-define-action: authentication and authorisation", () => {
  const handler = () => Promise.resolve(1);

  it("returns UNAUTHENTICATED when no session exists", async () => {
    const { defineAction } = harness({}, null);
    const action = defineAction({ name: "x", input, auth: "user", handler });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("returns FORBIDDEN for the wrong role", async () => {
    const { defineAction } = harness({}, user);
    const action = defineAction({ name: "x", input, auth: { role: "super_admin" }, handler });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("requires aal2 when asked", async () => {
    const aal1Admin: SessionView = { ...admin, aal: "aal1" };
    const strict = harness({}, aal1Admin).defineAction({
      name: "x",
      input,
      auth: { role: "super_admin", aal2: true },
      handler,
    });
    expect(await strict(validInput)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const ok = harness({}, admin).defineAction({
      name: "x",
      input,
      auth: { role: "super_admin", aal2: true },
      handler,
    });
    expect(await ok(validInput)).toMatchObject({ ok: true });
  });

  it("does not even look up a session for auth none", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({ name: "x", input, auth: "none", handler });
    await action(validInput);
    expect(calls).not.toContain("authenticate");
  });

  it("skips handler, invalidation and audit when authorisation fails", async () => {
    const { defineAction, calls } = harness({}, null);
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      invalidate: () => ["t"],
      audit: { action: "a" },
      handler: () => {
        calls.push("handler");
        return Promise.resolve(1);
      },
    });
    await action(validInput);
    expect(calls).toEqual(["authenticate"]);
  });
});

describe("UT-define-action: idempotency, rate limit, invalidation", () => {
  it("replays the stored result without running the handler again", async () => {
    const stored = { ok: true, data: "first" };
    const { defineAction, calls } = harness({
      beginIdempotent: () => Promise.resolve({ replay: true, result: stored }),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      idempotencyKey: (i) => i.idempotencyKey,
      handler: () => {
        calls.push("handler");
        return Promise.resolve("second");
      },
    });
    expect(await action(validInput)).toEqual(stored);
    expect(calls).not.toContain("handler");
  });

  it("surfaces RATE_LIMITED with retryAfter and stops", async () => {
    const { defineAction, calls } = harness({
      rateLimit: () =>
        Promise.reject(new ActionError("RATE_LIMITED", "Slow down", { retryAfter: 30 })),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      rateLimit: { scope: "s" },
      handler: () => {
        calls.push("handler");
        return Promise.resolve(1);
      },
    });
    expect(await action(validInput)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 30,
    });
    expect(calls).not.toContain("handler");
  });

  it("does not invalidate the cache when the handler throws", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      invalidate: () => ["t"],
      handler: () => Promise.reject(new Error("db down")),
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(calls.some((c) => c.startsWith("invalidate"))).toBe(false);
  });
});

describe("UT-define-action: fail-closed defaults (Stage 1 skeleton)", () => {
  const quiet = createLogger({}, { write: () => undefined });
  const defineAction = createDefineAction({ ...failClosedDeps, log: quiet });

  it("denies an action that needs a session, because none is wired yet", async () => {
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.resolve(1),
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("refuses to run rate-limited, idempotent, audited or invalidating actions until the real parts exist", async () => {
    for (const extra of [
      { rateLimit: { scope: "s" } },
      { idempotencyKey: () => "k" },
      { audit: { action: "a" } },
      { invalidate: () => ["t"] },
    ]) {
      const action = defineAction({
        name: "x",
        input,
        auth: "none",
        handler: () => Promise.resolve(1),
        ...extra,
      });
      expect(await action(validInput)).toMatchObject({ ok: false, code: "INTERNAL" });
    }
  });

  it("runs a plain public action", async () => {
    const action = defineAction({
      name: "x",
      input,
      auth: "none",
      handler: () => Promise.resolve("hi"),
    });
    expect(await action(validInput)).toEqual({ ok: true, data: "hi" });
  });
});

describe("UT-define-action: error normalisation never leaks details", () => {
  it("returns a safe message and a request id for unexpected errors, and logs a redacted version", async () => {
    const { defineAction, lines } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () =>
        Promise.reject(
          new Error("connection to postgres://admin:hunter2@db failed for priya@example.com"),
        ),
    });
    const result = await action(validInput);
    expect(result).toMatchObject({ ok: false, code: "INTERNAL", requestId: "req-1" });
    const text = JSON.stringify(result);
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("stack");
    expect(lines.join("\n")).not.toContain("priya@example.com");
  });

  it("maps Postgres and PostgREST codes to the closed set", () => {
    expect(classifyError({ code: "23505" })).toBe("CONFLICT");
    expect(classifyError({ code: "42501" })).toBe("FORBIDDEN");
    expect(classifyError({ code: "PGRST116" })).toBe("NOT_FOUND");
    expect(classifyError({ code: "23514" })).toBe("VALIDATION");
    expect(classifyError({ code: "XX000" })).toBe("INTERNAL");
    expect(classifyError("a string")).toBe("INTERNAL");
  });

  it("returns the code of a deliberate ActionError but never its developer message", () => {
    expect(toFailure(new ActionError("NOT_FOUND", "No such listing."))).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("returns no sentence at all: failures carry codes and keys only", async () => {
    const { defineAction } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.resolve(1),
    });
    const result = await action({ id: "not-a-uuid" });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result).not.toHaveProperty("message");
    expect(result.ok === false && result.fieldErrors?.id?.[0]?.key).toMatch(/^validation\./);
  });
});
