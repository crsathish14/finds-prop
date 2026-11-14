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
import type { ErrorContext } from "@/server/observability";

const user: SessionView = {
  userId: "u1",
  roles: ["customer"],
  phoneVerified: false,
  builderId: null,
};
const verifiedUser: SessionView = { ...user, phoneVerified: true };
const admin: SessionView = { ...user, userId: "a1", roles: ["super_admin", "customer"] };
const builder: SessionView = {
  ...user,
  userId: "b1",
  roles: ["builder", "customer"],
  builderId: "builder-record-1",
};

function harness(overrides: Partial<ActionDeps> = {}, session: SessionView | null = user) {
  const calls: string[] = [];
  const lines: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
    },
    beginIdempotent: ({ key }) => {
      calls.push(`idempotency:${key}`);
      return Promise.resolve({ replay: false });
    },
    completeIdempotent: ({ key }) => {
      calls.push(`complete:${key}`);
      return Promise.resolve();
    },
    releaseIdempotent: ({ key }) => {
      calls.push(`release:${key}`);
      return Promise.resolve();
    },
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
      rateLimit: { scope: "listing_create" },
      idempotencyKey: (parsed) => parsed.idempotencyKey,
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
      "rateLimit:listing_create",
      "idempotency:k1",
      "handler",
      "invalidate:property:1",
      "audit:listing.sold",
      "complete:k1",
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
      handler: ({ input: parsedInput }) => Promise.resolve(parsedInput.tag),
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

  it("lets the admin through a super_admin action", async () => {
    const action = harness({}, admin).defineAction({
      name: "x",
      input,
      auth: { role: "super_admin" },
      handler,
    });
    expect(await action(validInput)).toMatchObject({ ok: true });
  });

  it("asks for a verified phone on a verified-phone action, with the reason", async () => {
    const withoutPhone = harness({}, user).defineAction({
      name: "x",
      input,
      auth: "verified-phone",
      handler,
    });
    expect(await withoutPhone(validInput)).toEqual({
      ok: false,
      code: "FORBIDDEN",
      reason: "PHONE_NOT_VERIFIED",
    });
    const withPhone = harness({}, verifiedUser).defineAction({
      name: "x",
      input,
      auth: "verified-phone",
      handler,
    });
    expect(await withPhone(validInput)).toMatchObject({ ok: true });
  });

  it("needs the builder role and an active builder record (BR-34)", async () => {
    const run = (session: SessionView | null) =>
      harness({}, session).defineAction({ name: "x", input, auth: { role: "builder" }, handler })(
        validInput,
      );
    expect(await run(builder)).toMatchObject({ ok: true });
    expect(await run({ ...builder, builderId: null })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await run({ ...builder, roles: ["customer"] })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await run(user)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await run(null)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
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
      idempotencyKey: (parsed) => parsed.idempotencyKey,
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
      rateLimit: { scope: "enquiry" },
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
    expect(calls.some((call) => call.startsWith("invalidate"))).toBe(false);
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

  it("refuses to run rate-limited or idempotent actions until the real parts exist", async () => {
    for (const extra of [
      { rateLimit: { scope: "enquiry" as const } },
      { idempotencyKey: () => "k" },
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

describe("UT-define-action: the full pipeline (S3-T12)", () => {
  const handler = () => Promise.resolve("saved");
  const claimed = { idempotencyKey: (parsed: { idempotencyKey: string }) => parsed.idempotencyKey };

  it("returns the first result for a repeat, and never runs the handler twice", async () => {
    const stored = { ok: true, data: "first" };
    const { defineAction, calls } = harness({
      beginIdempotent: () => Promise.resolve({ replay: true, result: stored }),
    });
    const action = defineAction({ name: "x", input, auth: "user", ...claimed, handler });
    expect(await action(validInput)).toEqual(stored);
    expect(calls).not.toContain("complete:k1");
    expect(calls).not.toContain("release:k1");
  });

  it("refuses a repeat of a request that is still running with CONFLICT", async () => {
    const { defineAction, calls } = harness({
      beginIdempotent: () => Promise.reject(new ActionError("CONFLICT", "running")),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      ...claimed,
      handler: () => {
        calls.push("handler");
        return Promise.resolve(1);
      },
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(calls).not.toContain("handler");
  });

  it("gives the claim back when the handler fails, so the user can try again", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      ...claimed,
      handler: () => Promise.reject(new ActionError("CONFLICT", "duplicate")),
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(calls).toContain("release:k1");
    expect(calls).not.toContain("complete:k1");
  });

  it("keeps the claim once the handler succeeded", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({ name: "x", input, auth: "user", ...claimed, handler });
    await action(validInput);
    expect(calls).toContain("complete:k1");
    expect(calls).not.toContain("release:k1");
  });

  it("reports the handler's own failure even when giving the claim back fails", async () => {
    const { defineAction, lines } = harness({
      releaseIdempotent: () => Promise.reject(new Error("database down")),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      ...claimed,
      handler: () => Promise.reject(new ActionError("NOT_FOUND", "gone")),
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(lines.join("\n")).toContain("giving the idempotency claim back failed");
  });

  it("does not try to release a claim that was never made", async () => {
    const { defineAction, calls } = harness();
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.reject(new Error("boom")),
    });
    await action(validInput);
    expect(calls.some((call) => call.startsWith("release"))).toBe(false);
  });

  it("still succeeds when the audit write fails after the data was saved, and logs it", async () => {
    const { defineAction, lines } = harness({
      audit: () => Promise.reject(new Error("audit down")),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      audit: { action: "listing.sold" },
      handler,
    });
    expect(await action(validInput)).toEqual({ ok: true, data: "saved" });
    expect(lines.join("\n")).toContain("audit failed after the write");
  });

  it("still succeeds when cache invalidation fails after the write, and logs it", async () => {
    const { defineAction, lines } = harness({
      invalidate: () => {
        throw new Error("cache down");
      },
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      invalidate: () => ["t"],
      handler,
    });
    expect(await action(validInput)).toEqual({ ok: true, data: "saved" });
    expect(lines.join("\n")).toContain("cache invalidation failed after the write");
  });

  it("still succeeds when the idempotent result cannot be stored, and logs it", async () => {
    const { defineAction, lines } = harness({
      completeIdempotent: () => Promise.reject(new Error("store down")),
    });
    const action = defineAction({ name: "x", input, auth: "user", ...claimed, handler });
    expect(await action(validInput)).toEqual({ ok: true, data: "saved" });
    expect(lines.join("\n")).toContain("storing the idempotent result failed after the write");
  });

  it("passes the rate limit key and the request id to the limiter", async () => {
    const seen: unknown[] = [];
    const { defineAction } = harness({
      rateLimit: (request) => {
        seen.push(request);
        return Promise.resolve();
      },
    });
    const action = defineAction({
      name: "x",
      input: z.object({ id: z.uuid(), phone: z.string() }),
      auth: "none",
      rateLimit: { scope: "otp_request", key: (parsed) => parsed.phone },
      handler,
    });
    await action({ ...validInput, phone: "+919000000001" });
    expect(seen).toEqual([
      { scope: "otp_request", session: null, requestId: "req-1", key: "+919000000001" },
    ]);
  });

  it("names the audited entity from the result and the input", async () => {
    const events: unknown[] = [];
    const { defineAction } = harness({
      audit: (event) => {
        events.push(event);
        return Promise.resolve();
      },
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      audit: {
        action: "listing.sold",
        entity: (_result, parsed) => ({ type: "property", id: parsed.id }),
      },
      handler,
    });
    await action(validInput);
    expect(events).toEqual([
      {
        action: "listing.sold",
        entity: { type: "property", id: validInput.id },
        session: user,
        requestId: "req-1",
      },
    ]);
  });

  it("accepts a request id that arrives asynchronously", async () => {
    const { defineAction } = harness({ newRequestId: () => Promise.resolve("req-async-1") });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.reject(new Error("boom")),
    });
    expect(await action(validInput)).toMatchObject({ requestId: "req-async-1" });
  });
});

describe("UT-define-action: error tracker (ADR-130)", () => {
  function tracked(session: SessionView | null = user) {
    const reports: { error: unknown; context: ErrorContext }[] = [];
    const rig = harness(
      {
        reportError: (error, context) => {
          reports.push({ error, context });
          return Promise.resolve();
        },
      },
      session,
    );
    return { ...rig, reports };
  }

  it("reports an unexpected error with the action, the request id and the role, never the input", async () => {
    const { defineAction, reports } = tracked(builder);
    const boom = new Error("db down");
    const action = defineAction({
      name: "updateProject",
      input,
      auth: "user",
      handler: () => Promise.reject(boom),
    });
    expect(await action(validInput)).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(reports).toEqual([
      {
        error: boom,
        context: {
          source: "action",
          requestId: "req-1",
          route: "updateProject",
          errorCode: "INTERNAL",
          role: "builder",
        },
      },
    ]);
    expect(JSON.stringify(reports[0]?.context)).not.toContain(validInput.id);
  });

  it.each([
    ["bad input", { id: "nope" }, "user" as const, user],
    ["no session", validInput, "user" as const, null],
    ["a missing record", validInput, "user" as const, user],
  ])("does not report %s, which is not a bug", async (label, raw, auth, session) => {
    const { defineAction, reports } = tracked(session);
    const action = defineAction({
      name: "x",
      input,
      auth,
      handler: () =>
        label === "a missing record"
          ? Promise.reject(new ActionError("NOT_FOUND", "no such record"))
          : Promise.resolve(1),
    });
    const result = await action(raw);
    expect(result.ok).toBe(false);
    expect(reports).toEqual([]);
  });

  it("reports a failure after the write, and the caller still gets the success", async () => {
    const reports: { error: unknown; context: ErrorContext }[] = [];
    const { defineAction } = harness(
      {
        audit: () => Promise.reject(new Error("audit table down")),
        reportError: (error, context) => {
          reports.push({ error, context });
          return Promise.resolve();
        },
      },
      admin,
    );
    const action = defineAction({
      name: "approveListing",
      input,
      auth: "user",
      audit: { action: "listing.approved" },
      handler: () => Promise.resolve("saved"),
    });
    expect(await action(validInput)).toEqual({ ok: true, data: "saved" });
    expect(reports).toHaveLength(1);
    expect(reports[0]?.context).toMatchObject({
      source: "action",
      route: "approveListing",
      errorCode: "AFTER_WRITE",
      role: "super_admin",
    });
  });

  it("reports nothing when every step works", async () => {
    const { defineAction, reports } = tracked(admin);
    const action = defineAction({
      name: "approveListing",
      input,
      auth: "user",
      audit: { action: "listing.approved" },
      handler: () => Promise.resolve("saved"),
    });
    expect(await action(validInput)).toEqual({ ok: true, data: "saved" });
    expect(reports).toEqual([]);
  });

  it("labels a visitor with no session as anonymous", async () => {
    const { defineAction, reports } = tracked(null);
    const action = defineAction({
      name: "submitEnquiry",
      input,
      auth: "none",
      handler: () => Promise.reject(new Error("boom")),
    });
    await action(validInput);
    expect(reports[0]?.context.role).toBe("anonymous");
  });

  it("still returns the safe failure when the tracker itself throws", async () => {
    const { defineAction } = harness({
      reportError: () => Promise.reject(new Error("tracker down")),
    });
    const action = defineAction({
      name: "x",
      input,
      auth: "user",
      handler: () => Promise.reject(new Error("boom")),
    });
    await expect(action(validInput)).resolves.toMatchObject({ ok: false, code: "INTERNAL" });
  });
});
