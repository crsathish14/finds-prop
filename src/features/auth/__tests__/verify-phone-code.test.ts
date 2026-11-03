import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { verifyPhoneCodeConfig } from "../action-config";
import { confirmPhoneCode, type PhoneCodeDeps, type PhoneCodeError } from "../service";

const PHONE_AS_TYPED = "98765 43210";
const PHONE = "+919876543210";
const CODE = "482916";

type Verify = Parameters<PhoneCodeDeps["verifyOtp"]>[0];

function fakeClient(answer: { error?: PhoneCodeError | null; session?: object | null } = {}) {
  const requests: Verify[] = [];
  const deps: PhoneCodeDeps = {
    signInWithOtp: () => Promise.reject(new Error("checking a code never sends one")),
    verifyOtp: (credentials) => {
      requests.push(credentials);
      return Promise.resolve({
        data: { session: answer.session === undefined ? { access_token: "x" } : answer.session },
        error: answer.error ?? null,
      });
    },
  };
  return { deps, requests };
}

function actionHarness(
  options: { rateLimited?: boolean; error?: PhoneCodeError; session?: object | null } = {},
) {
  const calls: string[] = [];
  const rateLimitKeys: (string | undefined)[] = [];
  const logLines: string[] = [];
  const { deps, requests } = fakeClient({
    error: options.error ?? null,
    ...(options.session !== undefined ? { session: options.session } : {}),
  });
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(null);
    },
    rateLimit: ({ scope, key }) => {
      calls.push(`rateLimit:${scope}`);
      rateLimitKeys.push(key);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 2520 }))
        : Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: (line) => logLines.push(line) }),
  };
  const action = createDefineAction(actionDeps)({
    ...verifyPhoneCodeConfig,
    handler: ({ input }) => confirmPhoneCode(deps, input),
  });
  return { action, calls, rateLimitKeys, requests, logLines };
}

describe("UT-verify-phone-code: the service (S3-T09, FR-AUTH-01)", () => {
  it("checks the code as an SMS code for the normalised number and reports a sign-in", async () => {
    const { deps, requests } = fakeClient();
    await expect(confirmPhoneCode(deps, { phone: PHONE, code: CODE })).resolves.toEqual({
      signedIn: true,
    });
    expect(requests).toEqual([{ phone: PHONE, token: CODE, type: "sms" }]);
  });

  it("does not say the visitor is signed in when Supabase returned no session", async () => {
    const { deps } = fakeClient({ session: null });
    await expect(confirmPhoneCode(deps, { phone: PHONE, code: CODE })).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it.each<[string, PhoneCodeError, object]>([
    [
      "a wrong or expired code",
      { code: "otp_expired", status: 403 },
      { code: "VALIDATION", fieldErrors: { code: [{ key: "validation.codeWrong" }] } },
    ],
    [
      "Supabase's request limit",
      { code: "over_request_rate_limit", status: 429 },
      { code: "RATE_LIMITED", retryAfter: 60 },
    ],
    [
      "the phone provider being off",
      { code: "otp_disabled", status: 422 },
      { code: "UPSTREAM_FAILED" },
    ],
    ["a server error", { status: 502 }, { code: "UPSTREAM_FAILED" }],
    ["something unknown", { code: "validation_failed", status: 422 }, { code: "INTERNAL" }],
  ])("maps %s", async (_what, error, expected) => {
    const { deps } = fakeClient({ error });
    await expect(confirmPhoneCode(deps, { phone: PHONE, code: CODE })).rejects.toMatchObject(
      expected,
    );
  });
});

describe("UT-verify-phone-code: the action pipeline", () => {
  it("signs a visitor in who is not signed in yet, after the otp_verify limit, for the normalised number", async () => {
    const { action, calls, rateLimitKeys, requests } = actionHarness();
    await expect(action({ phone: PHONE_AS_TYPED, code: CODE })).resolves.toEqual({
      ok: true,
      data: { signedIn: true },
    });
    expect(calls).toEqual(["rateLimit:otp_verify"]);
    expect(rateLimitKeys).toEqual([PHONE]);
    expect(requests).toEqual([{ phone: PHONE, token: CODE, type: "sms" }]);
  });

  it("does not look at who the caller is", async () => {
    const { action, calls } = actionHarness();
    await action({ phone: PHONE_AS_TYPED, code: CODE });
    expect(calls).not.toContain("authenticate");
  });

  it.each([
    ["five digits", "48291"],
    ["seven digits", "4829160"],
    ["letters", "48291a"],
    ["spaces", "482 916"],
    ["empty", ""],
  ])(
    "refuses a code with %s, before the limit counts it and before Supabase hears of it",
    async (_what, code) => {
      const { action, calls, requests } = actionHarness();
      const result = await action({ phone: PHONE_AS_TYPED, code });
      expect(result).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { code: [{ key: "validation.codeInvalid" }] },
      });
      expect(calls).toEqual([]);
      expect(requests).toHaveLength(0);
    },
  );

  it("refuses a missing code and a number from another country the same way", async () => {
    const { action, requests } = actionHarness();
    expect(await action({ phone: PHONE_AS_TYPED })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await action({ phone: "+44 7700 900123", code: CODE })).toMatchObject({
      ok: false,
      fieldErrors: { phone: [{ key: "validation.phoneUnsupported" }] },
    });
    expect(requests).toHaveLength(0);
  });

  it("reports a wrong code on the code field", async () => {
    const { action } = actionHarness({ error: { code: "otp_expired", status: 403 } });
    expect(await action({ phone: PHONE_AS_TYPED, code: CODE })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { code: [{ key: "validation.codeWrong" }] },
    });
  });

  it("is rate limited with the wait time, and checks nothing when it is", async () => {
    const { action, requests } = actionHarness({ rateLimited: true });
    expect(await action({ phone: PHONE_AS_TYPED, code: CODE })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 2520,
    });
    expect(requests).toHaveLength(0);
  });

  it("ignores identity fields the caller invents", async () => {
    const { action, requests } = actionHarness();
    await action({
      phone: PHONE_AS_TYPED,
      code: CODE,
      userId: "someone-else",
      role: "super_admin",
      type: "recovery",
    });
    expect(requests).toEqual([{ phone: PHONE, token: CODE, type: "sms" }]);
  });

  it("never logs the number or the code, on success or on failure (R-BE-10)", async () => {
    const ok = actionHarness();
    await ok.action({ phone: PHONE_AS_TYPED, code: CODE });
    const wrong = actionHarness({ error: { code: "otp_expired", status: 403 } });
    await wrong.action({ phone: PHONE_AS_TYPED, code: CODE });
    const down = actionHarness({ error: { code: "otp_disabled", status: 422 } });
    await down.action({ phone: PHONE_AS_TYPED, code: CODE });
    const everything = [...ok.logLines, ...wrong.logLines, ...down.logLines].join("\n");
    expect(everything.length).toBeGreaterThan(0);
    for (const secret of ["9876543210", "98765 43210", CODE]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("returns codes only: no sentence and no session in the failure", async () => {
    const { action } = actionHarness({ error: { code: "otp_disabled", status: 422 } });
    expect(await action({ phone: PHONE_AS_TYPED, code: CODE })).toEqual({
      ok: false,
      code: "UPSTREAM_FAILED",
    });
  });
});
