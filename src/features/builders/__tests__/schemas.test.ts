import { describe, expect, it } from "vitest";
import {
  inviteBuilderSchema,
  resendInvitationSchema,
  setBuilderActiveSchema,
  updateBuilderSchema,
  updateMyProfileSchema,
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

describe("UT-builder-schemas: the Developer Spotlight fields (ADR-179)", () => {
  it("takes a tagline, a year and a count typed in boxes, and blank boxes as no value", () => {
    expect(
      updateMyProfileSchema.parse({
        name: "Kadal Homes",
        tagline: " Homes  by the sea ",
        establishedYear: " 2004 ",
        projectsDelivered: "18",
        logoPath: `${BUILDER}/logo-1.webp`,
      }),
    ).toEqual({
      name: "Kadal Homes",
      tagline: "Homes by the sea",
      establishedYear: 2004,
      projectsDelivered: 18,
      logoPath: `${BUILDER}/logo-1.webp`,
    });
    expect(
      updateMyProfileSchema.parse({
        name: "Kadal Homes",
        tagline: "",
        establishedYear: "",
        projectsDelivered: " ",
        logoPath: "",
      }),
    ).toEqual({
      name: "Kadal Homes",
      tagline: null,
      establishedYear: null,
      projectsDelivered: null,
      logoPath: null,
    });
  });

  it("refuses a long tagline, a year out of range, a count that is not a whole number and a strange logo path", () => {
    const refused = (extra: Record<string, unknown>) =>
      updateMyProfileSchema.safeParse({ name: "Kadal Homes", ...extra }).success;
    expect(refused({ tagline: "a".repeat(101) })).toBe(false);
    expect(refused({ establishedYear: "1850" })).toBe(false);
    expect(refused({ establishedYear: String(new Date().getFullYear() + 1) })).toBe(false);
    expect(refused({ establishedYear: "two thousand" })).toBe(false);
    expect(refused({ projectsDelivered: "-3" })).toBe(false);
    expect(refused({ projectsDelivered: "4.5" })).toBe(false);
    expect(refused({ logoPath: "../logo.webp" })).toBe(false);
    expect(refused({ logoPath: `${BUILDER}/logo.svg` })).toBe(false);
  });

  it("lets the admin correct the spotlight text, but not the uploaded logo", () => {
    expect(
      updateBuilderSchema.parse({
        builderId: BUILDER,
        ...base,
        projectsDelivered: "20",
        logoPath: `${BUILDER}/logo-1.webp`,
      }),
    ).toMatchObject({ projectsDelivered: 20 });
    expect(
      "logoPath" in
        updateBuilderSchema.parse({
          builderId: BUILDER,
          ...base,
          logoPath: `${BUILDER}/logo-1.webp`,
        }),
    ).toBe(false);
  });
});

describe("UT-builder-schemas: the builder's own profile (S7-T03)", () => {
  it("takes the company name alone, and reads blank boxes as no value", () => {
    expect(updateMyProfileSchema.parse({ name: "Kadal Homes" })).toEqual({ name: "Kadal Homes" });
    expect(
      updateMyProfileSchema.parse({
        name: " Kadal  Homes ",
        contactPerson: " ",
        phone: "+91 98410-55512",
        logoUrl: "",
        website: "https://kadalhomes.example",
        description: "",
      }),
    ).toEqual({
      name: "Kadal Homes",
      contactPerson: null,
      phone: "+919841055512",
      logoUrl: null,
      website: "https://kadalhomes.example",
      description: null,
    });
  });

  it("refuses a missing name, a link that is not https and a phone that is not a number", () => {
    expect(updateMyProfileSchema.safeParse({ name: " " }).success).toBe(false);
    expect(
      updateMyProfileSchema.safeParse({ name: "Kadal Homes", website: "http://kadal.example" })
        .success,
    ).toBe(false);
    expect(updateMyProfileSchema.safeParse({ name: "Kadal Homes", phone: "call me" }).success).toBe(
      false,
    );
  });

  it("leaves out what a builder may not set: the type, the email and whose profile it is", () => {
    expect(
      updateMyProfileSchema.parse({
        name: "Kadal Homes",
        kind: "agent",
        email: "other@example.test",
        builderId: BUILDER,
      }),
    ).toEqual({ name: "Kadal Homes" });
  });
});
