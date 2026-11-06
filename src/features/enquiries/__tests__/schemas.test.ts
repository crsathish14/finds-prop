import { describe, expect, it } from "vitest";
import { sendEnquirySchema } from "../schemas";

const KEY = "00000000-0000-4000-8000-000000000001";
const valid = {
  shortId: "k3x9a2bd",
  name: "Priya Raman",
  phone: "9840012345",
  idempotencyKey: KEY,
};

function issues(input: Record<string, unknown>) {
  const result = sendEnquirySchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

describe("sendEnquirySchema: what an enquiry takes from the browser (S5-T03)", () => {
  it("accepts the smallest enquiry: a home, a name, a phone and a key", () => {
    const result = sendEnquirySchema.parse(valid);
    expect(result).toEqual({
      shortId: "k3x9a2bd",
      name: "Priya Raman",
      phone: "9840012345",
      idempotencyKey: KEY,
    });
  });

  it("tidies the name, the email and the message, and drops empty optional boxes", () => {
    const result = sendEnquirySchema.parse({
      ...valid,
      name: "  Priya   Raman ",
      email: "  PRIYA@Example.com ",
      message: "   ",
    });
    expect(result.name).toBe("Priya Raman");
    expect(result.email).toBe("priya@example.com");
    expect(result.message).toBeUndefined();
    expect(sendEnquirySchema.parse({ ...valid, email: "" }).email).toBeUndefined();
  });

  it("reads a phone with spaces, dashes, brackets and a plus as plain digits", () => {
    expect(sendEnquirySchema.parse({ ...valid, phone: "+91 98400-12345" }).phone).toBe(
      "919840012345",
    );
    expect(sendEnquirySchema.parse({ ...valid, phone: "(044) 2345 6789" }).phone).toBe(
      "04423456789",
    );
  });

  it.each([
    ["too short", "12345"],
    ["too long", "1234567890123456"],
    ["letters", "98400abcde"],
    ["empty", ""],
  ])("refuses a phone that is %s", (_label, phone) => {
    expect(issues({ ...valid, phone })).toEqual([
      { path: "phone", message: "validation.phoneInvalid" },
    ]);
  });

  it("refuses a name that is too short, or has a control character", () => {
    expect(issues({ ...valid, name: "P" })).toEqual([
      { path: "name", message: "validation.nameTooShort" },
    ]);
    expect(issues({ ...valid, name: "Priya\u0007Raman" })).toEqual([
      { path: "name", message: "validation.invalid" },
    ]);
  });

  it("refuses an email that is not one, and a message over 1000 characters", () => {
    expect(issues({ ...valid, email: "not-an-email" })).toEqual([
      { path: "email", message: "validation.emailInvalid" },
    ]);
    expect(issues({ ...valid, message: "x".repeat(1001) }).map((issue) => issue.path)).toEqual([
      "message",
    ]);
    expect(issues({ ...valid, message: "x".repeat(1000) })).toEqual([]);
  });

  it("refuses a home id that is not a short id, and a key that is not a UUID", () => {
    expect(issues({ ...valid, shortId: "../admin" }).map((issue) => issue.path)).toEqual([
      "shortId",
    ]);
    expect(issues({ ...valid, idempotencyKey: "not-a-uuid" }).map((issue) => issue.path)).toEqual([
      "idempotencyKey",
    ]);
  });
});
