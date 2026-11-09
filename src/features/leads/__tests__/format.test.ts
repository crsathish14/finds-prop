import { describe, expect, it } from "vitest";
import { LEAD_KINDS, SUBMISSION_RANGES } from "../constants";
import { answerText, KIND_KEYS, leadsHref, phoneParts, RANGE_KEYS, retryDelay } from "../format";

describe("UT-lead-format: the mobile number as the admin reads it (S7-T07)", () => {
  it("shows ten digits in two groups of five, as a call link", () => {
    expect(phoneParts("9841055512")).toEqual({ text: "98410 55512", href: "tel:9841055512" });
  });

  it("shows twelve digits with the country code, and calls them with a plus", () => {
    expect(phoneParts("919841055512")).toEqual({
      text: "+91 98410 55512",
      href: "tel:+919841055512",
    });
  });

  it("shows any other number as it is, rather than guess at its groups", () => {
    expect(phoneParts("04412345678")).toEqual({ text: "04412345678", href: "tel:04412345678" });
    expect(phoneParts("12345")).toEqual({ text: "12345", href: "tel:12345" });
  });
});

describe("UT-lead-format: an answer as text (S7-T07)", () => {
  const words = { yes: "Yes", no: "No" };

  it("joins a list with commas, says yes or no, and writes a number out", () => {
    expect(answerText(["Parking", "Gym"], words)).toBe("Parking, Gym");
    expect(answerText(true, words)).toBe("Yes");
    expect(answerText(false, words)).toBe("No");
    expect(answerText(80, words)).toBe("80");
    expect(answerText("1 Cr", words)).toBe("1 Cr");
  });
});

describe("UT-lead-format: when the next retry is (S7-T07)", () => {
  const now = Date.parse("2026-11-08T10:00:00.000Z");
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  it("says minutes under an hour, hours under a day, and days after", () => {
    expect(retryDelay(at(30), now)).toEqual({ unit: "minutes", count: 30 });
    expect(retryDelay(at(0.5), now)).toEqual({ unit: "minutes", count: 1 });
    expect(retryDelay(at(90), now)).toEqual({ unit: "hours", count: 2 });
    expect(retryDelay(at(24 * 60 * 3), now)).toEqual({ unit: "days", count: 3 });
  });

  it("says soon for a retry that is due or past, or a time that cannot be read", () => {
    expect(retryDelay(at(0), now)).toEqual({ unit: "soon" });
    expect(retryDelay(at(-5), now)).toEqual({ unit: "soon" });
    expect(retryDelay("tomorrow", now)).toEqual({ unit: "soon" });
  });
});

describe("UT-leads-href: the address of the Leads page (S7-T07)", () => {
  it("has no query for the project leads tab", () => {
    expect(leadsHref({ tab: "leads" })).toBe("/admin/leads");
  });

  it("names the submissions tab and leaves out the defaults", () => {
    expect(leadsHref({ tab: "submissions" })).toBe("/admin/leads?tab=submissions");
    expect(leadsHref({ tab: "submissions", range: "30", crm: "any", form: "", source: "" })).toBe(
      "/admin/leads?tab=submissions",
    );
  });

  it("adds each choice that is not the default, and makes the source safe", () => {
    expect(
      leadsHref({
        tab: "submissions",
        range: "7",
        form: "f1",
        project: "p1",
        source: "a b&c",
        crm: "failed",
      }),
    ).toBe("/admin/leads?tab=submissions&range=7&form=f1&project=p1&source=a+b%26c&crm=failed");
  });
});

describe("UT-lead-format: every kind and date choice has a word's name", () => {
  it("names each one with a plain key", () => {
    for (const kind of LEAD_KINDS) expect(KIND_KEYS[kind]).toMatch(/^[a-z][A-Za-z0-9]*$/);
    for (const range of SUBMISSION_RANGES) expect(RANGE_KEYS[range]).toMatch(/^[a-z][A-Za-z0-9]*$/);
  });
});
