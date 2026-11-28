import { describe, expect, it } from "vitest";
import { WEB_SEARCH_MAX_DOMAINS, WEB_SEARCH_TRUSTED_DOMAINS } from "../web-search";

// UT-config-web-search-domains (ADR-218): the owner's trusted list (28 Nov 2026) is a list OpenAI accepts and that does
// what it says: plain domains, no repeats, none already covered by another entry, and no property portal.
const domains = WEB_SEARCH_TRUSTED_DOMAINS;

describe("the trusted websites of the web search", () => {
  it("are the owner's 64 domains, within OpenAI's limit", () => {
    expect(domains).toHaveLength(64);
    expect(domains.length).toBeLessThanOrEqual(WEB_SEARCH_MAX_DOMAINS);
  });

  it("are plain domains: lower case, no scheme, no www, no path", () => {
    for (const domain of domains) {
      expect(domain).toMatch(/^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  it("hold no repeat and no domain another entry already covers", () => {
    expect(new Set(domains).size).toBe(domains.length);
    for (const domain of domains) {
      const parent = domains.find((other) => other !== domain && domain.endsWith(`.${other}`));
      expect(parent, `${domain} is covered by ${parent}`).toBeUndefined();
    }
  });

  it("put the banks on their .bank.in addresses, not the old ones that only redirect", () => {
    for (const old of [
      "sbi.co.in",
      "hdfcbank.com",
      "icicibank.com",
      "axisbank.com",
      "canarabank.com",
    ]) {
      expect(domains).not.toContain(old);
    }
    expect(domains.filter((domain) => domain.endsWith(".bank.in"))).toHaveLength(8);
  });

  it("never include a property portal (a competitor)", () => {
    const portals = [
      "99acres.com",
      "magicbricks.com",
      "nobroker.in",
      "housing.com",
      "squareyards.com",
      "commonfloor.com",
      "makaan.com",
    ];
    for (const domain of domains) {
      for (const portal of portals) {
        expect(domain === portal || domain.endsWith(`.${portal}`)).toBe(false);
      }
    }
  });
});
