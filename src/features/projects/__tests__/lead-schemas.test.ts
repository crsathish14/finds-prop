import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toFieldErrors } from "@/server/actions/field-errors";
import { submitProjectLeadSchema, trackProjectEventSchema } from "../lead-schemas";

const KEY = "8f14e45f-ceea-4672-9a4c-2d6c3a1b7e90";

const lead = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  kind: "enquiry",
  name: "Priya Raman",
  idempotencyKey: KEY,
  ...overrides,
});

function errorsOf(raw: unknown) {
  const result = submitProjectLeadSchema.safeParse(raw);
  if (result.success) throw new Error("expected the input to be refused");
  return toFieldErrors(result.error, raw);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("UT-project-lead-schema: what the browser may send (S4-T09 step D)", () => {
  it("takes an enquiry with only a name, and leaves the optional values out", () => {
    const parsed = submitProjectLeadSchema.parse(lead());
    expect(parsed).toMatchObject({ slug: "kadal-vista", kind: "enquiry", name: "Priya Raman" });
    expect(parsed.email).toBeUndefined();
    expect(parsed.message).toBeUndefined();
    expect(parsed.visitDate).toBeUndefined();
  });

  it("cleans the typed values: spaces, case, and empty boxes read as nothing", () => {
    const parsed = submitProjectLeadSchema.parse(
      lead({
        name: "  Priya   Raman ",
        email: "  PRIYA@Example.COM ",
        message: "  Hello  ",
        visitDate: "",
      }),
    );
    expect(parsed.name).toBe("Priya Raman");
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.message).toBe("Hello");
    expect(parsed.visitDate).toBeUndefined();
    const blank = submitProjectLeadSchema.parse(lead({ email: "", message: "   " }));
    expect(blank.email).toBeUndefined();
    expect(blank.message).toBeUndefined();
  });

  it("carries no phone: the number is the signed-in account's, read on the server", () => {
    const parsed = submitProjectLeadSchema.parse(lead({ phone: "9999999999" }));
    expect(parsed).not.toHaveProperty("phone");
  });

  it("refuses a name that is too short or has control characters", () => {
    expect(errorsOf(lead({ name: "P" }))["name"]).toEqual([{ key: "validation.nameTooShort" }]);
    expect(errorsOf(lead({ name: "" }))["name"]).toEqual([{ key: "validation.nameTooShort" }]);
    expect(errorsOf(lead({ name: "Priya\u0007Raman" }))["name"]).toEqual([
      { key: "validation.invalid" },
    ]);
    expect(errorsOf(lead({ name: "A".repeat(81) }))["name"]).toBeDefined();
  });

  it("refuses an email that is not one", () => {
    expect(errorsOf(lead({ email: "not-an-email" }))["email"]).toEqual([
      { key: "validation.emailInvalid" },
    ]);
  });

  it("refuses a message over 1,000 characters, saying how many are allowed", () => {
    expect(errorsOf(lead({ message: "a".repeat(1001) }))["message"]).toEqual([
      { key: "validation.tooLong", values: { maximum: 1000 } },
    ]);
    expect(submitProjectLeadSchema.safeParse(lead({ message: "a".repeat(1000) })).success).toBe(
      true,
    );
  });

  it("refuses a kind other than Enquire or Site visit, such as a brochure", () => {
    expect(errorsOf(lead({ kind: "brochure" }))["kind"]).toEqual([{ key: "validation.invalid" }]);
  });

  it("refuses a slug that is not a project's", () => {
    for (const slug of ["", "Kadal Vista", "../admin", "a"]) {
      expect(errorsOf(lead({ slug }))["slug"], slug).toBeDefined();
    }
  });

  it("needs a one-time key that is a UUID", () => {
    expect(errorsOf(lead({ idempotencyKey: "abc" }))["idempotencyKey"]).toBeDefined();
    expect(errorsOf({ ...lead(), idempotencyKey: undefined })["idempotencyKey"]).toBeDefined();
  });

  it("asks for a date on a site visit", () => {
    expect(errorsOf(lead({ kind: "site_visit" }))["visitDate"]).toEqual([
      { key: "validation.required" },
    ]);
    expect(errorsOf(lead({ kind: "site_visit", visitDate: "" }))["visitDate"]).toEqual([
      { key: "validation.required" },
    ]);
  });

  it("accepts a site visit from today to a year ahead", () => {
    for (const visitDate of ["2026-11-05", "2026-12-01", "2027-11-05"]) {
      expect(
        submitProjectLeadSchema.safeParse(lead({ kind: "site_visit", visitDate })).success,
        visitDate,
      ).toBe(true);
    }
  });

  it("refuses a site visit in the past, too far ahead, or not a date, with the range message", () => {
    for (const visitDate of ["2026-11-04", "2027-11-06", "2026-02-30", "soon"]) {
      expect(errorsOf(lead({ kind: "site_visit", visitDate }))["visitDate"], visitDate).toEqual([
        { key: "validation.visitDateRange" },
      ]);
    }
  });

  it("does not look at a date on an enquiry", () => {
    expect(submitProjectLeadSchema.safeParse(lead({ visitDate: "2020-01-01" })).success).toBe(true);
  });
});

describe("UT-project-event-schema: what the page may report", () => {
  it("takes a view of a project", () => {
    expect(trackProjectEventSchema.parse({ slug: "kadal-vista", event: "view" })).toEqual({
      slug: "kadal-vista",
      event: "view",
    });
  });

  it("takes no other kind of event yet: Call, WhatsApp, brochure and shortlist are not recorded", () => {
    for (const event of ["call", "whatsapp", "brochure", "shortlist", "compare", ""]) {
      expect(trackProjectEventSchema.safeParse({ slug: "kadal-vista", event }).success, event).toBe(
        false,
      );
    }
  });

  it("refuses a slug that is not a project's", () => {
    expect(trackProjectEventSchema.safeParse({ slug: "No Way", event: "view" }).success).toBe(
      false,
    );
  });
});
