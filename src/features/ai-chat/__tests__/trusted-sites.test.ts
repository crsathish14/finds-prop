import { describe, expect, it } from "vitest";
import { findTrustedHomes, isTrustedSiteHome, webSourceHref } from "../trusted-sites";

// UT-ai-trusted-sites (ADR-218, owner 28 Nov 2026): which web addresses the chat may draw as links.
describe("the trusted websites as links", () => {
  it("knows a trusted website's home, and its subdomains, never a page or another site", () => {
    expect(isTrustedSiteHome("rera.tn.gov.in")).toBe(true);
    expect(isTrustedSiteHome("realestatechecker.in")).toBe(true);
    expect(isTrustedSiteHome("rera.tn.gov.in/search")).toBe(false);
    expect(isTrustedSiteHome("faketn.gov.in")).toBe(false);
    expect(isTrustedSiteHome("tn.gov.in.example.test")).toBe(false);
  });

  it("lets a web source be a link only when it is a plain https page on a trusted website", () => {
    expect(webSourceHref("https://www.realestatechecker.in/builder/chennai/dac")).toBe(
      "https://www.realestatechecker.in/builder/chennai/dac",
    );
    expect(webSourceHref("http://rera.tn.gov.in/")).toBeNull();
    expect(webSourceHref("https://user:pw@rera.tn.gov.in/")).toBeNull();
    expect(webSourceHref("https://example.test/page")).toBeNull();
    expect(webSourceHref(`https://rera.tn.gov.in/${"x".repeat(400)}`)).toBeNull();
  });

  it("finds the trusted home addresses in an answer, with their links, and leaves paths and other sites as text", () => {
    const text =
      "Check it on the Tamil Nadu RERA website, rera.tn.gov.in. Rates are on https://www.sbi.bank.in/ too.";
    expect(findTrustedHomes(text)).toEqual([
      expect.objectContaining({ text: "rera.tn.gov.in", href: "https://rera.tn.gov.in" }),
      expect.objectContaining({ text: "https://www.sbi.bank.in/", href: "https://sbi.bank.in" }),
    ]);
    expect(findTrustedHomes("See rera.tn.gov.in/project-search or example.test.")).toEqual([]);
    expect(findTrustedHomes("Mail help@sbi.bank.in")).toEqual([]);
  });
});
