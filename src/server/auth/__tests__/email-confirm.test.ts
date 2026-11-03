import { describe, expect, it } from "vitest";
import { emailResultPath, parseEmailResult } from "@/lib/url/email-result";
import { createLogger } from "../../logger";
import { handleEmailConfirm, type EmailConfirmDeps } from "../email-confirm";

const TOKEN = "fake-token-hash-for-tests";

function harness(error: { code?: string } | null = null) {
  const requests: Parameters<EmailConfirmDeps["verifyOtp"]>[0][] = [];
  const logLines: string[] = [];
  const deps: EmailConfirmDeps = {
    verifyOtp: (credentials) => {
      requests.push(credentials);
      return Promise.resolve({ error });
    },
    log: createLogger({}, { write: (line) => logLines.push(line) }),
  };
  return { deps, requests, logLines };
}

describe("UT-email-confirm: finishing an email link (S3-T09, FR-AUTH-02)", () => {
  it("confirms the email and sends the visitor to the verified page", async () => {
    const { deps, requests } = harness();
    await expect(
      handleEmailConfirm({ tokenHash: TOKEN, type: "email_change" }, deps),
    ).resolves.toBe("/auth?email=verified");
    expect(requests).toEqual([{ token_hash: TOKEN, type: "email_change" }]);
  });

  it.each([
    ["an expired or used link", { code: "otp_expired" }],
    ["an unknown error", { code: "unexpected_failure" }],
    ["an error with no code", {}],
  ])("sends the visitor to the same expired page for %s", async (_what, error) => {
    const { deps } = harness(error);
    await expect(
      handleEmailConfirm({ tokenHash: TOKEN, type: "email_change" }, deps),
    ).resolves.toBe("/auth?email=expired");
  });

  it.each<[string, { tokenHash: string | null; type: string | null }]>([
    ["no token", { tokenHash: null, type: "email_change" }],
    ["an empty token", { tokenHash: "", type: "email_change" }],
    ["a token with odd characters", { tokenHash: "abc def<script>12345", type: "email_change" }],
    ["a token that is too long", { tokenHash: "a".repeat(201), type: "email_change" }],
    ["a token that is too short", { tokenHash: "abc", type: "email_change" }],
    ["no type", { tokenHash: TOKEN, type: null }],
    ["another type (recovery)", { tokenHash: TOKEN, type: "recovery" }],
    ["another type (magiclink)", { tokenHash: TOKEN, type: "magiclink" }],
    ["another type (signup)", { tokenHash: TOKEN, type: "signup" }],
  ])("refuses %s without asking Supabase", async (_what, query) => {
    const { deps, requests } = harness();
    await expect(handleEmailConfirm(query, deps)).resolves.toBe("/auth?email=expired");
    expect(requests).toHaveLength(0);
  });

  it("never logs the token", async () => {
    const refused = harness({ code: "otp_expired" });
    await handleEmailConfirm({ tokenHash: TOKEN, type: "email_change" }, refused.deps);
    const odd = harness();
    await handleEmailConfirm({ tokenHash: "x y z", type: "recovery" }, odd.deps);
    const everything = [...refused.logLines, ...odd.logLines].join("\n");
    expect(everything.length).toBeGreaterThan(0);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain("x y z");
  });

  it("only ever answers with one of our two result paths", async () => {
    for (const error of [null, { code: "otp_expired" }]) {
      const { deps } = harness(error);
      const path = await handleEmailConfirm({ tokenHash: TOKEN, type: "email_change" }, deps);
      expect([emailResultPath("verified"), emailResultPath("expired")]).toContain(path);
    }
  });
});

describe("UT-email-result: the page's reading of ?email=", () => {
  it.each([
    ["verified", "verified"],
    ["expired", "expired"],
    [["expired", "verified"], "expired"],
  ] as const)("reads %j as %s", (value, expected) => {
    expect(parseEmailResult(value as string | string[])).toBe(expected);
  });

  it.each([undefined, "", "VERIFIED", "done", "../x", ["nope"]])("ignores %j", (value) => {
    expect(parseEmailResult(value)).toBeNull();
  });
});
