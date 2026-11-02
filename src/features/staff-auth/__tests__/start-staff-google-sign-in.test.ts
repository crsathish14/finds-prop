import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { startStaffGoogleSignInConfig } from "../action-config";
import { createStaffGoogleSignIn, type StaffGoogleSignInDeps } from "../service";

const SUPABASE_URL = "https://abcdefghij.supabase.co";
const GOOGLE_ADDRESS = `${SUPABASE_URL}/auth/v1/authorize?provider=google&code_challenge=abc`;

function fakeClient(answer?: Awaited<ReturnType<StaffGoogleSignInDeps["signInWithOAuth"]>>) {
  const requests: Parameters<StaffGoogleSignInDeps["signInWithOAuth"]>[0][] = [];
  const deps: StaffGoogleSignInDeps = {
    signInWithOAuth: (credentials) => {
      requests.push(credentials);
      return Promise.resolve(answer ?? { data: { url: GOOGLE_ADDRESS }, error: null });
    },
    siteUrl: "http://localhost:3000",
    supabaseUrl: SUPABASE_URL,
  };
  return { deps, requests };
}

function actionHarness(options: { rateLimited?: boolean; session?: SessionView | null } = {}) {
  const calls: string[] = [];
  const { deps, requests } = fakeClient();
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(options.session ?? null);
    },
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 600 }))
        : Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const action = createDefineAction(actionDeps)({
    ...startStaffGoogleSignInConfig,
    handler: ({ input }) => createStaffGoogleSignIn(deps, input),
  });
  return { action, calls, requests };
}

describe("UT-start-staff-google-sign-in: the service (S3-T10)", () => {
  it("asks Supabase for a Google address that comes back to our callback, without redirecting", async () => {
    const { deps, requests } = fakeClient();
    await expect(createStaffGoogleSignIn(deps, { area: "builder" })).resolves.toEqual({
      url: GOOGLE_ADDRESS,
    });
    expect(requests).toEqual([
      {
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback?area=builder",
          skipBrowserRedirect: true,
        },
      },
    ]);
  });

  it("builds the return address from the site address and carries only a safe go-back page", async () => {
    const safe = fakeClient();
    await createStaffGoogleSignIn(safe.deps, { area: "admin", next: "/admin/listings" });
    expect(safe.requests[0]?.options.redirectTo).toBe(
      "http://localhost:3000/auth/callback?area=admin&next=%2Fadmin%2Flistings",
    );
    const unsafe = fakeClient();
    await createStaffGoogleSignIn(unsafe.deps, { area: "admin", next: "//evil.example" });
    expect(unsafe.requests[0]?.options.redirectTo).toBe(
      "http://localhost:3000/auth/callback?area=admin",
    );
  });

  it("fails when Supabase answers with an error or no address", async () => {
    const refused = fakeClient({ data: { url: null }, error: { message: "boom" } });
    await expect(createStaffGoogleSignIn(refused.deps, { area: "builder" })).rejects.toMatchObject({
      code: "UPSTREAM_FAILED",
    });
    const empty = fakeClient({ data: { url: null }, error: null });
    await expect(createStaffGoogleSignIn(empty.deps, { area: "builder" })).rejects.toMatchObject({
      code: "UPSTREAM_FAILED",
    });
  });

  it("refuses an address that is not on the project's own Supabase host", async () => {
    const elsewhere = fakeClient({
      data: { url: "https://evil.example/auth/v1/authorize" },
      error: null,
    });
    await expect(
      createStaffGoogleSignIn(elsewhere.deps, { area: "builder" }),
    ).rejects.toMatchObject({ code: "UPSTREAM_FAILED" });
  });
});

describe("UT-start-staff-google-sign-in: the action pipeline", () => {
  it("works for a visitor who is not signed in, after the rate limit", async () => {
    const { action, calls } = actionHarness();
    await expect(action({ area: "builder" })).resolves.toEqual({
      ok: true,
      data: { url: GOOGLE_ADDRESS },
    });
    expect(calls).toEqual(["rateLimit:staff_sign_in"]);
  });

  it("does not look at who the caller is (the visitor is not signed in yet)", async () => {
    const { action, calls } = actionHarness();
    await action({ area: "admin" });
    expect(calls).not.toContain("authenticate");
  });

  it("refuses an area that is not a staff area", async () => {
    const { action, requests } = actionHarness();
    const result = await action({ area: "customer" });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(requests).toHaveLength(0);
  });

  it("refuses input with no area", async () => {
    const { action } = actionHarness();
    expect(await action({})).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("ignores identity fields the caller invents", async () => {
    const { action, requests } = actionHarness();
    await action({ area: "builder", userId: "someone-else", role: "super_admin", builderId: "x" });
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).not.toContain("someone-else");
  });

  it("is rate limited, and starts nothing when it is", async () => {
    const { action, requests } = actionHarness({ rateLimited: true });
    expect(await action({ area: "builder" })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(requests).toHaveLength(0);
  });
});
