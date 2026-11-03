import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { addEmailConfig, resendEmailLinkConfig } from "../action-config";
import {
  addEmailAddress,
  resendEmailAddress,
  type EmailLinkDeps,
  type EmailLinkError,
} from "../email-service";

const SESSION: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const EMAIL = "priya.raman@example.com";

function fakeEmail(error: EmailLinkError | null = null) {
  const sent: { how: "update" | "resend"; email: string }[] = [];
  const deps: EmailLinkDeps = {
    updateEmail: (email) => {
      sent.push({ how: "update", email });
      return Promise.resolve({ error });
    },
    resendEmail: (email) => {
      sent.push({ how: "resend", email });
      return Promise.resolve({ error });
    },
  };
  return { deps, sent };
}

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; error?: EmailLinkError } = {},
) {
  const calls: string[] = [];
  const logLines: string[] = [];
  const { deps, sent } = fakeEmail(options.error ?? null);
  const session = options.session === undefined ? SESSION : options.session;
  const actionDeps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: ({ scope, key }) => {
      calls.push(`rateLimit:${scope}:${key ?? "no-key"}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 1500 }))
        : Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: (line) => logLines.push(line) }),
  };
  const define = createDefineAction(actionDeps);
  const add = define({
    ...addEmailConfig,
    handler: ({ input }) => addEmailAddress(deps, input),
  });
  const resend = define({
    ...resendEmailLinkConfig,
    handler: ({ input }) => resendEmailAddress(deps, input),
  });
  return { add, resend, calls, sent, logLines };
}

describe("UT-add-email: the service (S3-T09, FR-AUTH-02)", () => {
  it("attaches the address and reports it with the wait before a resend", async () => {
    const { deps, sent } = fakeEmail();
    await expect(addEmailAddress(deps, { email: EMAIL })).resolves.toEqual({
      email: EMAIL,
      resendAfter: 60,
    });
    expect(sent).toEqual([{ how: "update", email: EMAIL }]);
  });

  it("sends the link again through the resend call, not by attaching the address again", async () => {
    const { deps, sent } = fakeEmail();
    await expect(resendEmailAddress(deps, { email: EMAIL })).resolves.toMatchObject({
      email: EMAIL,
    });
    expect(sent).toEqual([{ how: "resend", email: EMAIL }]);
  });

  it.each<[string, EmailLinkError, object]>([
    [
      "an address already used by another account",
      { code: "email_exists", status: 422 },
      { code: "VALIDATION", fieldErrors: { email: [{ key: "validation.emailTaken" }] } },
    ],
    [
      "an address that clashes with an identity",
      { code: "email_conflict_identity_not_deletable", status: 422 },
      { code: "VALIDATION", fieldErrors: { email: [{ key: "validation.emailTaken" }] } },
    ],
    [
      "an address Supabase says is invalid",
      { code: "email_address_invalid", status: 400 },
      { code: "VALIDATION", fieldErrors: { email: [{ key: "validation.emailInvalid" }] } },
    ],
    [
      "Supabase's own email limit",
      { code: "over_email_send_rate_limit", status: 429 },
      { code: "RATE_LIMITED", retryAfter: 60 },
    ],
    ["a session that is gone", { code: "bad_jwt", status: 401 }, { code: "UNAUTHENTICATED" }],
    [
      "email sending not allowed for this address",
      { code: "email_address_not_authorized", status: 400 },
      { code: "UPSTREAM_FAILED" },
    ],
    ["a server error", { status: 502 }, { code: "UPSTREAM_FAILED" }],
    ["something unknown", { code: "validation_failed", status: 422 }, { code: "INTERNAL" }],
  ])("maps %s", async (_what, error, expected) => {
    const { deps } = fakeEmail(error);
    await expect(addEmailAddress(deps, { email: EMAIL })).rejects.toMatchObject(expected);
  });

  it("gives the same answer for every reason an address cannot be used, so nobody learns whose it is", async () => {
    const answers: unknown[] = [];
    for (const code of [
      "email_exists",
      "email_conflict_identity_not_deletable",
      "identity_already_exists",
    ]) {
      const { deps } = fakeEmail({ code, status: 422 });
      answers.push(
        await addEmailAddress(deps, { email: EMAIL }).catch((error: ActionError) => ({
          code: error.code,
          fieldErrors: error.fieldErrors,
        })),
      );
    }
    expect(new Set(answers.map((answer) => JSON.stringify(answer))).size).toBe(1);
  });

  it("keeps the address out of the error it throws", async () => {
    const { deps } = fakeEmail({ code: "unexpected_failure", status: 500 });
    const thrown = await addEmailAddress(deps, { email: EMAIL }).catch((error: unknown) => error);
    expect(String((thrown as Error).message)).not.toContain("priya");
    expect(String((thrown as Error).message)).not.toContain("example.com");
  });
});

describe("UT-add-email: the action pipeline", () => {
  it("adds the address for a signed-in customer, after authenticating and the email limit", async () => {
    const { add, calls, sent } = harness();
    await expect(add({ email: EMAIL })).resolves.toEqual({
      ok: true,
      data: { email: EMAIL, resendAfter: 60 },
    });
    expect(calls).toEqual(["authenticate", "rateLimit:email_link:no-key"]);
    expect(sent).toEqual([{ how: "update", email: EMAIL }]);
  });

  it.each([
    ["  Priya.Raman@Example.COM  ", EMAIL],
    ["PRIYA.RAMAN@EXAMPLE.COM", EMAIL],
    ["a+tag@sub.example.co.in", "a+tag@sub.example.co.in"],
  ])("saves %j as %j", async (typed, saved) => {
    const { add, sent } = harness();
    expect(await add({ email: typed })).toMatchObject({ ok: true });
    expect(sent[0]?.email).toBe(saved);
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["no at sign", "priya.example.com"],
    ["no domain", "priya@"],
    ["no dot in the domain", "priya@example"],
    ["spaces inside", "pri ya@example.com"],
    ["two at signs", "a@b@example.com"],
    ["over 254 characters", `${"a".repeat(250)}@example.com`],
  ])(
    "refuses an address with %s, before the limit counts it and before any email",
    async (_what, typed) => {
      const { add, calls, sent } = harness();
      expect(await add({ email: typed })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { email: [{ key: "validation.emailInvalid" }] },
      });
      expect(calls).toEqual([]);
      expect(sent).toHaveLength(0);
    },
  );

  it("refuses a missing or non-text address the same way", async () => {
    const { add, sent } = harness();
    expect(await add({})).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await add({ email: 42 })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(sent).toHaveLength(0);
  });

  it("refuses a visitor who is not signed in, and sends nothing", async () => {
    const { add, calls, sent } = harness({ session: null });
    expect(await add({ email: EMAIL })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(calls).toEqual(["authenticate"]);
    expect(sent).toHaveLength(0);
  });

  it("refuses an account with no verified phone, and sends nothing", async () => {
    const { add, sent } = harness({ session: { ...SESSION, phoneVerified: false } });
    expect(await add({ email: EMAIL })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      reason: "PHONE_NOT_VERIFIED",
    });
    expect(sent).toHaveLength(0);
  });

  it("is rate limited with the wait time, and sends nothing when it is", async () => {
    const { add, sent } = harness({ rateLimited: true });
    expect(await add({ email: EMAIL })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 1500,
    });
    expect(sent).toHaveLength(0);
  });

  it("counts a resend against the same limit and uses the resend call", async () => {
    const { resend, calls, sent } = harness();
    expect(await resend({ email: EMAIL })).toMatchObject({ ok: true });
    expect(calls).toEqual(["authenticate", "rateLimit:email_link:no-key"]);
    expect(sent).toEqual([{ how: "resend", email: EMAIL }]);
  });

  it("does not resend when the resend is rate limited", async () => {
    const { resend, sent } = harness({ rateLimited: true });
    expect(await resend({ email: EMAIL })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(sent).toHaveLength(0);
  });

  it("ignores identity fields the caller invents", async () => {
    const { add, sent } = harness();
    await add({ email: EMAIL, userId: "someone-else", id: "someone-else", role: "super_admin" });
    expect(sent).toEqual([{ how: "update", email: EMAIL }]);
  });

  it("never logs the address, on success or on failure (R-BE-10)", async () => {
    const ok = harness();
    await ok.add({ email: EMAIL });
    const taken = harness({ error: { code: "email_exists", status: 422 } });
    await taken.add({ email: EMAIL });
    const down = harness({ error: { code: "unexpected_failure", status: 500 } });
    await down.add({ email: EMAIL });
    const everything = [...ok.logLines, ...taken.logLines, ...down.logLines].join("\n");
    expect(everything.length).toBeGreaterThan(0);
    expect(everything).not.toContain("priya");
    expect(everything).not.toContain("example.com");
  });

  it("returns codes only: no sentence and no address in a failure", async () => {
    const { add } = harness({ error: { code: "unexpected_failure", status: 500 } });
    expect(await add({ email: EMAIL })).toEqual({ ok: false, code: "UPSTREAM_FAILED" });
  });
});
