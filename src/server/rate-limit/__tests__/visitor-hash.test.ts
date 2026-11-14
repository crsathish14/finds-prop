import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { clientIp, hashValue, networkAddress, visitorHash } from "@/server/rate-limit/visitor-hash";

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

describe("UT-visitor-hash-network: the address as the network counts it (ADR-128 section 7.1)", () => {
  it("keeps an IPv4 address whole", () => {
    expect(networkAddress("203.0.113.7")).toBe("203.0.113.7");
    expect(networkAddress("127.0.0.1")).toBe("127.0.0.1");
  });

  it("UT-ipv6-64: gives every address in one /64 block the same value", () => {
    const block = networkAddress("2001:db8:abcd:12::1");
    expect(block).toBe("2001:db8:abcd:12::/64");
    expect(networkAddress("2001:db8:abcd:12:ffff:ffff:ffff:ffff")).toBe(block);
    expect(networkAddress("2001:0db8:ABCD:0012:0000:0000:0000:0001")).toBe(block);
    expect(networkAddress("2001:db8:abcd:12:1:2:3:4")).toBe(block);
  });

  it("UT-ipv6-64-different: tells two /64 blocks apart", () => {
    expect(networkAddress("2001:db8:abcd:12::1")).not.toBe(networkAddress("2001:db8:abcd:13::1"));
    expect(networkAddress("2001:db8:abcd:12::1")).not.toBe(networkAddress("2001:db9:abcd:12::1"));
  });

  it("handles a compressed prefix, a zone and brackets", () => {
    expect(networkAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(networkAddress("::1")).toBe("0:0:0:0::/64");
    expect(networkAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(networkAddress("[2001:db8:abcd:12::1]")).toBe("2001:db8:abcd:12::/64");
  });

  it("counts an IPv4 address written inside IPv6 as that IPv4 address", () => {
    expect(networkAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(networkAddress("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("returns text that is not an address unchanged, so it still counts as something", () => {
    expect(networkAddress("not-an-address")).toBe("not-an-address");
    expect(networkAddress("2001:db8::1::2")).toBe("2001:db8::1::2");
    expect(networkAddress("2001:zzzz::1")).toBe("2001:zzzz::1");
    expect(networkAddress("1:2:3:4:5:6:7")).toBe("1:2:3:4:5:6:7");
  });

  it("hashes two addresses of one /64 to the same value and never contains the address", () => {
    const first = hashValue(secret, networkAddress("2001:db8:abcd:12::1"));
    const second = hashValue(secret, networkAddress("2001:db8:abcd:12:9:9:9:9"));
    expect(first).toBe(second);
    expect(first).not.toContain("2001");
  });
});
