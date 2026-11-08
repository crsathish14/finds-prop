import { describe, expect, it } from "vitest";
import {
  inviteBuilderSchema,
  resendInvitationSchema,
  setBuilderActiveSchema,
  updateBuilderSchema,
} from "../schemas";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const base = { name: "Kadal Homes", email: "sales@kadalhomes.example", kind: "builder" };

describe("UT-builder-schemas: the admin's builder forms (S7-T05)", () => {
  it("takes a company, an email and a type, and leaves the optional boxes out", () => {
    expect(inviteBuilderSchema.parse(base)).toEqual(base);
  });

  it("tidies the name, lower-cases and trims the email, and reads a blank box as no value", () => {
    expect(
      inviteBuilderSchema.parse({
        ...base,
        name: "  Kadal   Homes ",
        email: "  Sales@KadalHomes.Example ",
        contactPerson: "   ",
        phone: "",
        logoUrl: "",
        website: " ",
        description: "",
      }),
    ).toEqual({
      ...base,
      contactPerson: null,
      phone: null,
      logoUrl: null,
      website: null,
      description: null,
    });
  });

  it("takes a phone with spaces, dashes and a plus, and the links as https only", () => {
    expect(
      inviteBuilderSchema.parse({
        ...base,
        phone: "+91 98410-55512",
        website: "https://kadalhomes.example",
        logoUrl: "https://kadalhomes.example/logo.png",
        kind: "agent",
      }),
    ).toMatchObject({ phone: "+919841055512", kind: "agent" });
  });

  it.each([
    [{ ...base, name: "K" }, "name"],
    [{ ...base, email: "not an email" }, "email"],
    [{ ...base, email: "" }, "email"],
    [{ ...base, kind: "admin" }, "kind"],
    [{ ...base, phone: "12" }, "phone"],
    [{ ...base, website: "http://kadalhomes.example" }, "website"],
    [{ ...base, logoUrl: "javascript:alert(1)" }, "logoUrl"],
    [{ ...base, description: "x".repeat(2001) }, "description"],
    [{ ...base, name: "A".repeat(121) }, "name"],
  ])("refuses %j on the %s box", (input, field) => {
    const result = inviteBuilderSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it("edits the details of a builder by id, in lower case, and never the email", () => {
    const details = { name: base.name, kind: base.kind };
    const parsed = updateBuilderSchema.parse({
      builderId: BUILDER.toUpperCase(),
      ...details,
      email: "x@y.example",
    });
    expect(parsed.builderId).toBe(BUILDER);
    expect(parsed).not.toHaveProperty("email");
  });

  it("takes a builder id and a yes or no to activate, and an id to resend", () => {
    expect(setBuilderActiveSchema.parse({ builderId: BUILDER, active: false })).toEqual({
      builderId: BUILDER,
      active: false,
    });
    expect(setBuilderActiveSchema.safeParse({ builderId: BUILDER, active: "no" }).success).toBe(
      false,
    );
    expect(setBuilderActiveSchema.safeParse({ builderId: "nope", active: true }).success).toBe(
      false,
    );
    expect(resendInvitationSchema.parse({ builderId: BUILDER })).toEqual({ builderId: BUILDER });
    expect(resendInvitationSchema.safeParse({}).success).toBe(false);
  });
});
