import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkExceptions, evaluateAudit } from "../check-audit.mjs";
import { repoRoot } from "../lib/core.mjs";
import { rules } from "./helpers.mjs";

const TODAY = new Date("2026-11-17T12:00:00Z");

const advisory = (severity, id, name = "picomatch") => ({
  source: 1,
  name,
  title: `A ${severity} problem in ${name}`,
  url: `https://github.com/advisories/${id}`,
  severity,
  range: "<=1.0.0",
});

const report = (vulnerabilities) => ({ vulnerabilities });

const exception = (overrides = {}) => ({
  advisory: "GHSA-aaaa-bbbb-cccc",
  package: "picomatch",
  reason: "No patched version exists and only build tools use it.",
  reference: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  expires: "2026-12-17",
  ...overrides,
});

describe("G-11 check-audit: which advisories fail the gate", () => {
  it("passes a report with nothing in it", () => {
    expect(evaluateAudit(report({}), [], TODAY)).toEqual([]);
  });

  it("fails on a high advisory", () => {
    const found = evaluateAudit(
      report({ picomatch: { name: "picomatch", via: [advisory("high", "GHSA-aaaa-bbbb-cccc")] } }),
      [],
      TODAY,
    );
    expect(rules(found)).toEqual(["AUDIT-ADVISORY"]);
    expect(found[0]?.message).toContain("GHSA-aaaa-bbbb-cccc");
  });

  it("fails on a critical advisory", () => {
    const found = evaluateAudit(
      report({
        lodash: { name: "lodash", via: [advisory("critical", "GHSA-dddd-eeee-ffff", "lodash")] },
      }),
      [],
      TODAY,
    );
    expect(rules(found)).toEqual(["AUDIT-ADVISORY"]);
  });

  it("does not fail on a moderate or low advisory", () => {
    const found = evaluateAudit(
      report({
        next: { name: "next", via: [advisory("moderate", "GHSA-gggg-hhhh-iiii", "next")] },
        tiny: { name: "tiny", via: [advisory("low", "GHSA-jjjj-kkkk-llll", "tiny")] },
      }),
      [],
      TODAY,
    );
    expect(found).toEqual([]);
  });

  it("counts an advisory once however many packages depend on the package it is in", () => {
    const same = advisory("high", "GHSA-aaaa-bbbb-cccc");
    const found = evaluateAudit(
      report({
        picomatch: { name: "picomatch", via: [same] },
        vite: { name: "vite", via: ["picomatch", same] },
        tinyglobby: { name: "tinyglobby", via: ["picomatch"] },
      }),
      [],
      TODAY,
    );
    expect(found).toHaveLength(1);
  });
});

describe("G-11 check-audit: a dated exception", () => {
  const vulnerable = report({
    picomatch: { name: "picomatch", via: [advisory("high", "GHSA-aaaa-bbbb-cccc")] },
  });

  it("lets exactly the named advisory through", () => {
    expect(evaluateAudit(vulnerable, [exception()], TODAY)).toEqual([]);
  });

  it("matches the advisory id whatever its capitals", () => {
    expect(
      evaluateAudit(vulnerable, [exception({ advisory: "GHSA-AAAA-BBBB-CCCC" })], TODAY),
    ).toEqual([]);
  });

  it("still fails on every other high advisory", () => {
    const found = evaluateAudit(
      report({
        picomatch: { name: "picomatch", via: [advisory("high", "GHSA-aaaa-bbbb-cccc")] },
        other: { name: "other", via: [advisory("high", "GHSA-zzzz-yyyy-xxxx", "other")] },
      }),
      [exception()],
      TODAY,
    );
    expect(rules(found)).toEqual(["AUDIT-ADVISORY"]);
    expect(found[0]?.message).toContain("GHSA-zzzz-yyyy-xxxx");
  });

  it("stops excusing an advisory after its expiry date and says the exception expired", () => {
    const found = evaluateAudit(vulnerable, [exception({ expires: "2026-11-16" })], TODAY);
    expect(rules(found).sort()).toEqual(["AUDIT-ADVISORY", "AUDIT-EXCEPTION"]);
  });

  it("still excuses an advisory on the day the exception expires", () => {
    expect(evaluateAudit(vulnerable, [exception({ expires: "2026-11-17" })], TODAY)).toEqual([]);
  });

  it.each([
    ["no advisory id", { advisory: "" }],
    ["a malformed advisory id", { advisory: "CVE-2026-0001" }],
    ["no package", { package: "" }],
    ["a reason that is too short", { reason: "later" }],
    ["no reference", { reference: "" }],
    ["a reference that is not an https address", { reference: "http://example.test" }],
    ["no expiry date", { expires: "" }],
    ["an expiry that is not a date", { expires: "someday" }],
  ])("reports an exception with %s", (_name, overrides) => {
    expect(rules(checkExceptions([exception(overrides)], TODAY))).toContain("AUDIT-EXCEPTION");
  });

  it("an incomplete exception does not excuse anything", () => {
    const found = evaluateAudit(vulnerable, [exception({ reason: "" })], TODAY);
    expect(rules(found)).toContain("AUDIT-EXCEPTION");
  });
});

describe("G-11 check-audit: the exceptions file of this repository", () => {
  it("is complete today, so a malformed entry cannot be merged", () => {
    const entries = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "scripts", "policy", "audit-exceptions.json"), "utf8"),
    );
    expect(Array.isArray(entries)).toBe(true);
    expect(checkExceptions(entries, new Date("2026-11-17T12:00:00Z"))).toEqual([]);
  });
});
