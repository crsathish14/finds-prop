import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { sendPhoneCodeConfig } from "../action-config";
import { RESEND_AFTER_SECONDS } from "../constants";
import { requestPhoneCode, type PhoneCodeDeps, type PhoneCodeError } from "../service";

const TOKEN = "0.fake-turnstile-token-for-tests";
const PHONE_AS_TYPED = "98765 43210";
const PHONE = "+919876543210";

type Send = Parameters<PhoneCodeDeps["signInWithOtp"]>[0];

function fakeClient(error: PhoneCodeError | null = null) {
  const requests: Send[] = [];
  const deps: PhoneCodeDeps = {
    signInWithOtp: (credentials) => {
      requests.push(credentials);
      return Promise.resolve({ error });
    },
    verifyOtp: () => Promise.reject(new Error("sending a code never checks one")),
  };
  return { deps, requests };
}

function actionHarness(
  options: { rateLimited?: boolean; session?: SessionView | null; error?: PhoneCodeError } = {},
) {
  const calls: string[] = [];
  const rateLimitKeys: (string | undefined)[] = [];
  const logLines: string[] = [];
  const { deps, requests } = fakeClient(options.error ?? null);
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(options.session ?? null);
    },
    rateLimit: ({ scope, key }) => {
      calls.push(`rateLimit:${scope}`);
      rateLimitKeys.push(key);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 1800 }))
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
    ...sendPhoneCodeConfig,
    handler: ({ input }) => requestPhoneCode(deps, input),
  });
  return { action, calls, rateLimitKeys, requests, logLines };
}

describe("UT-send-phone-code: the service (S3-T09, FR-AUTH-01)", () => {
  it("asks Supabase for a code with the human-check token, and lets a new number sign up", async () => {
    const { deps, requests } = fakeClient();
    await expect(requestPhoneCode(deps, { phone: PHONE, captchaToken: TOKEN })).resolves.toEqual({
      resendAfter: RESEND_AFTER_SECONDS,
    });
    expect(requests).toEqual([
      { phone: PHONE, options: { captchaToken: TOKEN, shouldCreateUser: true } },
    ]);
  });

  it("offers a new code only after a minute", () => {
    expect(RESEND_AFTER_SECONDS).toBe(60);
  });

  it.each<[string, PhoneCodeError, object]>([
    [
      "a refused human check",
      { code: "captcha_failed", status: 400 },
      { code: "VALIDATION", fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] } },
    ],
    [
      "Supabase's own SMS limit",
      { code: "over_sms_send_rate_limit", status: 429 },
      { code: "RATE_LIMITED", retryAfter: 60 },
    ],
    [
      "Supabase's request limit",
      { code: "over_request_rate_limit", status: 429 },
      { code: "RATE_LIMITED", retryAfter: 60 },
    ],
    ["our hook failing", { code: "sms_send_failed", status: 500 }, { code: "UPSTREAM_FAILED" }],
    ["our hook timing out", { code: "hook_timeout", status: 504 }, { code: "UPSTREAM_FAILED" }],
    [
      "the phone provider being off",
      { code: "phone_provider_disabled", status: 422 },
      { code: "UPSTREAM_FAILED" },
    ],
    ["a server error with no code", { status: 502 }, { code: "UPSTREAM_FAILED" }],
    ["something unknown", { code: "validation_failed", status: 422 }, { code: "INTERNAL" }],
  ])("maps %s", async (_what, error, expected) => {
    const { deps } = fakeClient(error);
    await expect(
      requestPhoneCode(deps, { phone: PHONE, captchaToken: TOKEN }),
    ).rejects.toMatchObject(expected);
  });

  it("keeps the number and the token out of the error it throws", async () => {
    const { deps } = fakeClient({ code: "sms_send_failed", status: 500 });
    const thrown = await requestPhoneCode(deps, { phone: PHONE, captchaToken: TOKEN }).catch(
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(ActionError);
    expect(String((thrown as Error).message)).not.toContain("9876543210");
    expect(String((thrown as Error).message)).not.toContain(TOKEN);
  });
});

describe("UT-send-phone-code: the action pipeline", () => {
  it("sends a code to a visitor who is not signed in, after the rate limit, for the normalised number", async () => {
    const { action, calls, rateLimitKeys, requests } = actionHarness();
    await expect(action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN })).resolves.toEqual({
      ok: true,
      data: { resendAfter: 60 },
    });
    expect(calls).toEqual(["rateLimit:otp_request"]);
    expect(rateLimitKeys).toEqual([PHONE]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.phone).toBe(PHONE);
  });

  it("counts every way of typing one number as the same number", async () => {
    const first = actionHarness();
    await first.action({ phone: "+91 98765-43210", captchaToken: TOKEN });
    const second = actionHarness();
    await second.action({ phone: "09876543210", captchaToken: TOKEN });
    expect(first.rateLimitKeys).toEqual([PHONE]);
    expect(second.rateLimitKeys).toEqual([PHONE]);
  });

  it("does not look at who the caller is (the visitor is not signed in yet)", async () => {
    const { action, calls } = actionHarness();
    await action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN });
    expect(calls).not.toContain("authenticate");
  });

  it("refuses a mistyped number with the invalid-number message, and requests nothing", async () => {
    const { action, calls, requests } = actionHarness();
    const result = await action({ phone: "98765 4321", captchaToken: TOKEN });
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { phone: [{ key: "validation.phoneInvalid" }] },
    });
    expect(requests).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("refuses a number from another country before the rate limit and before any code is requested (FR-AUTH-09)", async () => {
    const { action, calls, requests } = actionHarness();
    const result = await action({ phone: "+44 7700 900123", captchaToken: TOKEN });
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { phone: [{ key: "validation.phoneUnsupported" }] },
    });
    expect(requests).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it.each([
    ["no token", { phone: PHONE_AS_TYPED }],
    ["an empty token", { phone: PHONE_AS_TYPED, captchaToken: "" }],
    ["a token that is not text", { phone: PHONE_AS_TYPED, captchaToken: 12345 }],
    ["a huge token", { phone: PHONE_AS_TYPED, captchaToken: "x".repeat(2049) }],
  ])("refuses a code request with %s (FR-AUTH-09)", async (_what, input) => {
    const { action, requests } = actionHarness();
    const result = await action(input);
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
    expect(requests).toHaveLength(0);
  });

  it("reports the human check being refused by Supabase on the token field", async () => {
    const { action } = actionHarness({ error: { code: "captcha_failed", status: 400 } });
    expect(await action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
  });

  it("is rate limited with a retry time, and requests nothing when it is", async () => {
    const { action, requests } = actionHarness({ rateLimited: true });
    expect(await action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 1800,
    });
    expect(requests).toHaveLength(0);
  });

  it("ignores identity fields the caller invents", async () => {
    const { action, requests } = actionHarness();
    await action({
      phone: PHONE_AS_TYPED,
      captchaToken: TOKEN,
      userId: "someone-else",
      role: "super_admin",
      shouldCreateUser: false,
    });
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).not.toContain("someone-else");
    expect(requests[0]?.options.shouldCreateUser).toBe(true);
  });

  it("never logs the number or the token, on success or on failure (R-BE-10)", async () => {
    const ok = actionHarness();
    await ok.action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN });
    const bad = actionHarness({ error: { code: "sms_send_failed", status: 500 } });
    await bad.action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN });
    const invalid = actionHarness();
    await invalid.action({ phone: "+44 7700 900123", captchaToken: TOKEN });
    const everything = [...ok.logLines, ...bad.logLines, ...invalid.logLines].join("\n");
    expect(everything.length).toBeGreaterThan(0);
    for (const secret of ["9876543210", "98765 43210", "7700 900123", "7700900123", TOKEN]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("returns codes and values only: no sentence and no number in the failure", async () => {
    const { action } = actionHarness({ error: { code: "sms_send_failed", status: 500 } });
    const result = await action({ phone: PHONE_AS_TYPED, captchaToken: TOKEN });
    expect(result).toEqual({ ok: false, code: "UPSTREAM_FAILED" });
  });
});
