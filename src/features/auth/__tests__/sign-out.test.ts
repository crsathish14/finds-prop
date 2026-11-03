import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { signOutConfig } from "../action-config";
import { endSession, type SignOutDeps, type SignOutError } from "../sign-out-service";

function fakeAuth(error: SignOutError | null = null) {
  let calls = 0;
  const deps: SignOutDeps = {
    signOut: () => {
      calls += 1;
      return Promise.resolve({ error });
    },
  };
  return { deps, calls: () => calls };
}

function harness(error: SignOutError | null = null) {
  const steps: string[] = [];
  const auth = fakeAuth(error);
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      steps.push("authenticate");
      return Promise.resolve(null);
    },
    rateLimit: () => {
      steps.push("rateLimit");
      return Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const action = createDefineAction(actionDeps)({
    ...signOutConfig,
    handler: () => endSession(auth.deps),
  });
  return { action, steps, calls: auth.calls };
}

describe("UT-sign-out: the service (S3-T09, FR-AUTH-08)", () => {
  it("ends the session once and says the visitor is signed out", async () => {
    const { deps, calls } = fakeAuth();
    await expect(endSession(deps)).resolves.toEqual({ signedOut: true });
    expect(calls()).toBe(1);
  });

  it.each([
    "session_not_found",
    "session_expired",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "bad_jwt",
    "no_authorization",
    "user_not_found",
  ])("counts %s as signed out, because there was nothing left to end", async (code) => {
    const { deps } = fakeAuth({ code, status: 401 });
    await expect(endSession(deps)).resolves.toEqual({ signedOut: true });
  });

  it.each<[string, SignOutError, object]>([
    ["a server error", { status: 502 }, { code: "UPSTREAM_FAILED" }],
    [
      "a server error with a code",
      { code: "unexpected_failure", status: 500 },
      { code: "UPSTREAM_FAILED" },
    ],
    ["something unknown", { code: "validation_failed", status: 422 }, { code: "INTERNAL" }],
    ["an error with no details", {}, { code: "INTERNAL" }],
  ])("does not say signed out after %s", async (_what, error, expected) => {
    const { deps } = fakeAuth(error);
    await expect(endSession(deps)).rejects.toMatchObject(expected);
  });
});

describe("UT-sign-out: the action pipeline", () => {
  it("signs out a visitor without looking up who they are or counting a limit", async () => {
    const { action, steps, calls } = harness();
    await expect(action({})).resolves.toEqual({ ok: true, data: { signedOut: true } });
    expect(steps).toEqual([]);
    expect(calls()).toBe(1);
  });

  it("works for a visitor whose session is already gone", async () => {
    const { action } = harness({ code: "session_not_found", status: 403 });
    await expect(action({})).resolves.toEqual({ ok: true, data: { signedOut: true } });
  });

  it("ignores anything the caller adds", async () => {
    const { action, calls } = harness();
    await expect(
      action({ scope: "global", userId: "someone-else", everywhere: true }),
    ).resolves.toMatchObject({ ok: true });
    expect(calls()).toBe(1);
  });

  it("refuses input that is not an object, and signs nobody out", async () => {
    const { action, calls } = harness();
    expect(await action("global")).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await action(undefined)).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls()).toBe(0);
  });

  it("reports a failure as a code only, so the visitor is not told they are signed out", async () => {
    const { action } = harness({ code: "unexpected_failure", status: 500 });
    expect(await action({})).toEqual({ ok: false, code: "UPSTREAM_FAILED" });
  });
});
