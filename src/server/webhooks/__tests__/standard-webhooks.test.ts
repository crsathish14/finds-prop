import { describe, expect, it } from "vitest";
import { verifyStandardWebhook } from "@/server/webhooks/standard-webhooks";

/**
 * The first case uses a signature made by Python's own HMAC, a separate implementation, so the
 * verifier is checked against something other than itself.
 */
const configured = "v1,whsec_dGVzdC1zaWduaW5nLWtleS1mb3ItdGhlLWhvb2s=";
const payload = '{"user":{"phone":"919000000001"},"sms":{"otp":"123456"}}';
const sentAt = 1730000000;
const expectedSignature = "+dGf9TTcksuZFp/jSDWImRDWz7SaMavK2LFdqfpMDYQ=";

const valid = {
  id: "msg_test_0001",
  timestamp: String(sentAt),
  signature: `v1,${expectedSignature}`,
  body: payload,
};

const check = (
  request: Partial<typeof valid>,
  overrides: { now?: number; signing?: string } = {},
) =>
  verifyStandardWebhook({
    secret: overrides.signing ?? configured,
    request: { ...valid, ...request },
    nowSeconds: overrides.now ?? sentAt,
  });

describe("UT-standard-webhooks: verifyStandardWebhook (R-BE-13)", () => {
  it("accepts a request signed by an independent implementation", () => {
    expect(check({})).toEqual({ valid: true });
  });

  it("accepts a secret written without its prefixes", () => {
    expect(check({}, { signing: "dGVzdC1zaWduaW5nLWtleS1mb3ItdGhlLWhvb2s=" })).toEqual({
      valid: true,
    });
  });

  it("refuses a changed body, id or timestamp", () => {
    expect(check({ body: payload.replace("123456", "654321") })).toEqual({
      valid: false,
      reason: "bad_signature",
    });
    expect(check({ id: "msg_test_0002" })).toEqual({ valid: false, reason: "bad_signature" });
    expect(check({ timestamp: String(sentAt + 1) }, { now: sentAt + 1 })).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("refuses a signature made with another secret", () => {
    const other = "v1,whsec_b3RoZXItc2lnbmluZy1rZXktZm9yLXRlc3Rz";
    expect(check({}, { signing: other })).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("refuses a request outside the five minute window, old or from the future", () => {
    expect(check({}, { now: sentAt + 301 })).toEqual({ valid: false, reason: "stale" });
    expect(check({}, { now: sentAt - 301 })).toEqual({ valid: false, reason: "stale" });
    expect(check({}, { now: sentAt + 299 })).toEqual({ valid: true });
  });

  it("refuses a timestamp that is not a plain number of seconds", () => {
    for (const timestamp of ["abc", "1.7e9", "-1", "", "17300000000000000"]) {
      const verdict = check({ timestamp });
      expect(verdict.valid).toBe(false);
    }
  });

  it("refuses a request with a missing header", () => {
    for (const name of ["id", "timestamp", "signature"] as const) {
      expect(check({ [name]: null })).toEqual({ valid: false, reason: "missing_headers" });
    }
  });

  it("refuses a secret that is not base64, instead of treating it as a key", () => {
    expect(check({}, { signing: "not base64 !!" })).toEqual({ valid: false, reason: "bad_secret" });
    expect(check({}, { signing: "v1,whsec_" })).toEqual({ valid: false, reason: "bad_secret" });
    expect(check({}, { signing: "" })).toEqual({ valid: false, reason: "bad_secret" });
  });

  it("accepts any one valid signature in the header, for secret rotation", () => {
    const wrong = "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    expect(check({ signature: `${wrong} v1,${expectedSignature}` })).toEqual({ valid: true });
    expect(check({ signature: `v1,${expectedSignature} ${wrong}` })).toEqual({ valid: true });
  });

  it("ignores signatures of another version and malformed entries", () => {
    expect(check({ signature: `v2,${expectedSignature}` })).toEqual({
      valid: false,
      reason: "bad_signature",
    });
    expect(check({ signature: "v1," })).toEqual({ valid: false, reason: "bad_signature" });
    expect(check({ signature: "garbage" })).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("refuses a signature of the wrong length without throwing", () => {
    expect(check({ signature: "v1,AAAA" })).toEqual({ valid: false, reason: "bad_signature" });
    expect(check({ signature: `v1,${expectedSignature}AAAA` })).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });
});
