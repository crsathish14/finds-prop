import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { saveProfileNameConfig } from "../action-config";
import { updateProfileName, type ProfileNameDeps } from "../profile-service";

const SESSION: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

type Update = { userId: string; fullName: string };

function fakeProfiles(answer: { error?: unknown; updated?: number } = {}) {
  const updates: Update[] = [];
  const deps: ProfileNameDeps = {
    updateName: (userId, fullName) => {
      updates.push({ userId, fullName });
      return Promise.resolve({ error: answer.error ?? null, updated: answer.updated ?? 1 });
    },
  };
  return { deps, updates };
}

function actionHarness(
  options: { session?: SessionView | null; error?: unknown; updated?: number } = {},
) {
  const calls: string[] = [];
  const { deps, updates } = fakeProfiles({
    ...(options.error !== undefined ? { error: options.error } : {}),
    ...(options.updated !== undefined ? { updated: options.updated } : {}),
  });
  const session = options.session === undefined ? SESSION : options.session;
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: () => {
      calls.push("rateLimit");
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
    ...saveProfileNameConfig,
    handler: ({ input, session: caller }) => {
      if (!caller) throw new ActionError("UNAUTHENTICATED", "A signed-in user is required");
      return updateProfileName(deps, caller.userId, input);
    },
  });
  return { action, calls, updates };
}

describe("UT-save-profile-name: the service (S3-T09, ADD-04)", () => {
  it("saves the name on the given user's profile and returns it", async () => {
    const { deps, updates } = fakeProfiles();
    await expect(updateProfileName(deps, "user-1", { name: "Priya Raman" })).resolves.toEqual({
      name: "Priya Raman",
    });
    expect(updates).toEqual([{ userId: "user-1", fullName: "Priya Raman" }]);
  });

  it("throws a database error as it is, for the one error mapper", async () => {
    const failure = { code: "23514", message: "check violation" };
    const { deps } = fakeProfiles({ error: failure });
    await expect(updateProfileName(deps, "user-1", { name: "Priya Raman" })).rejects.toBe(failure);
  });

  it("is not a success when no row changed", async () => {
    const { deps } = fakeProfiles({ updated: 0 });
    await expect(updateProfileName(deps, "user-1", { name: "Priya Raman" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("UT-save-profile-name: the action pipeline", () => {
  it("saves the signed-in visitor's own name, after authenticating, with no rate limit", async () => {
    const { action, calls, updates } = actionHarness();
    await expect(action({ name: "Priya Raman" })).resolves.toEqual({
      ok: true,
      data: { name: "Priya Raman" },
    });
    expect(calls).toEqual(["authenticate"]);
    expect(updates).toEqual([{ userId: "user-1", fullName: "Priya Raman" }]);
  });

  it.each([
    ["  Priya   Raman ", "Priya Raman"],
    ["Priya\tRaman", "Priya Raman"],
    ["प्रिया रमन", "प्रिया रमन"],
    ["Jo", "Jo"],
    ["x".repeat(80), "x".repeat(80)],
  ])("saves %j as %j", async (typed, saved) => {
    const { action, updates } = actionHarness();
    expect(await action({ name: typed })).toMatchObject({ ok: true });
    expect(updates[0]?.fullName).toBe(saved);
  });

  it.each([
    ["one character", "P"],
    ["only spaces", "    "],
    ["empty", ""],
    ["one character between spaces", "  P  "],
  ])("refuses %s with the too-short message, and saves nothing", async (_what, typed) => {
    const { action, updates } = actionHarness();
    expect(await action({ name: typed })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.nameTooShort" }] },
    });
    expect(updates).toHaveLength(0);
  });

  it("refuses a name over 80 characters", async () => {
    const { action, updates } = actionHarness();
    expect(await action({ name: "x".repeat(81) })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.tooLong", values: { maximum: 80 } }] },
    });
    expect(updates).toHaveLength(0);
  });

  it.each([
    ["a null character", "Priya\u0000Raman"],
    ["an invisible or bell character", "Priya​Raman\u0007"],
  ])("refuses a name with %s", async (_what, typed) => {
    const { action, updates } = actionHarness();
    expect(await action({ name: typed })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.invalid" }] },
    });
    expect(updates).toHaveLength(0);
  });

  it("refuses a missing or non-text name the same way", async () => {
    const { action, updates } = actionHarness();
    expect(await action({})).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await action({ name: 42 })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(updates).toHaveLength(0);
  });

  it("refuses a visitor who is not signed in, and saves nothing", async () => {
    const { action, updates } = actionHarness({ session: null });
    expect(await action({ name: "Priya Raman" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(updates).toHaveLength(0);
  });

  it("changes only the session user's profile, whatever ids the caller sends", async () => {
    const { action, updates } = actionHarness();
    await action({
      name: "Priya Raman",
      userId: "someone-else",
      id: "someone-else",
      role: "admin",
    });
    expect(updates).toEqual([{ userId: "user-1", fullName: "Priya Raman" }]);
  });

  it("maps a database refusal to a safe code, with no database text", async () => {
    const { action } = actionHarness({ error: { code: "23514", message: "secret detail" } });
    const result = await action({ name: "Priya Raman" });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("says not found, not saved, when the profile row is missing", async () => {
    const { action } = actionHarness({ updated: 0 });
    expect(await action({ name: "Priya Raman" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
