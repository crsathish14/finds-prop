import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { clientIp, hashValue, visitorHash } from "@/server/rate-limit/visitor-hash";

const secret = "a-test-secret-that-is-at-least-32-characters-long";

describe("UT-visitor-hash: the caller's address (S1-SPK-03, ADR-033)", () => {
  it("takes the first value of x-vercel-forwarded-for on Vercel", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
      "x-forwarded-for": "198.51.100.9",
    });
    expect(clientIp(headers, true)).toBe("203.0.113.7");
  });

  it("falls back to x-forwarded-for, then to the local address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" }), true)).toBe(
      "198.51.100.9",
    );
    expect(clientIp(new Headers(), true)).toBe("127.0.0.1");
  });

  it("ignores every proxy header outside a trusted deployment, so a made-up one changes nothing", () => {
    const spoofed = new Headers({ "x-vercel-forwarded-for": "203.0.113.7" });
    expect(clientIp(spoofed, false)).toBe("127.0.0.1");
  });
});

describe("UT-visitor-hash: the hash (BR-75)", () => {
  it("is 40 hex characters and stable", () => {
    const hash = visitorHash(secret, "203.0.113.7", "Mozilla/5.0");
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
    expect(visitorHash(secret, "203.0.113.7", "Mozilla/5.0")).toBe(hash);
  });

  it("differs by address, by browser and by secret", () => {
    const base = visitorHash(secret, "203.0.113.7", "Mozilla/5.0");
    expect(visitorHash(secret, "203.0.113.8", "Mozilla/5.0")).not.toBe(base);
    expect(visitorHash(secret, "203.0.113.7", "Chrome")).not.toBe(base);
    expect(visitorHash(`${secret}-other`, "203.0.113.7", "Mozilla/5.0")).not.toBe(base);
  });

  it("never contains the address it was made from", () => {
    expect(hashValue(secret, "203.0.113.7")).not.toContain("203");
    expect(hashValue(secret, "+919000000001")).not.toContain("9190");
  });

  it("refuses to work without the secret, so an unprotected anonymous call is never counted blind", () => {
    expect(() => visitorHash(undefined, "203.0.113.7", "ua")).toThrow(ActionError);
    expect(() => hashValue("", "x")).toThrow(/RATE_LIMIT_HMAC_SECRET/);
  });
});
