import { describe, expect, it } from "vitest";
import { decidePageAccess } from "@/server/auth/page-access";
import type { SessionView } from "@/server/auth/session";

const customer: SessionView = {
  userId: "u1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const builder: SessionView = {
  ...customer,
  roles: ["builder", "customer"],
  phoneVerified: false,
  builderId: "record-1",
};
const admin: SessionView = { ...customer, roles: ["super_admin", "customer"] };

describe("UT-page-access: where a visitor goes (plan 07 section 2.6)", () => {
  it("customer pages: signed out goes to sign-in and comes back", () => {
    expect(decidePageAccess("customer", null, "/dashboard?tab=saved")).toEqual({
      allowed: false,
      redirectTo: "/auth?redirect=%2Fdashboard%3Ftab%3Dsaved",
    });
    expect(decidePageAccess("customer", customer)).toEqual({ allowed: true, session: customer });
  });

  it("customer pages: an address that could leave the site is replaced by the home page (BR-06)", () => {
    for (const evil of ["//evil.example", "https://evil.example", "/\\evil.example", undefined]) {
      expect(decidePageAccess("customer", null, evil)).toEqual({
        allowed: false,
        redirectTo: "/auth?redirect=%2F",
      });
    }
  });

  it("builder pages: signed out goes to the builder sign-in", () => {
    expect(decidePageAccess("builder", null)).toEqual({
      allowed: false,
      redirectTo: "/builder/login",
    });
  });

  it("builder pages: no active builder access sees the notice on the builder sign-in", () => {
    const denied = { allowed: false, redirectTo: "/builder/login?denied=1" };
    expect(decidePageAccess("builder", customer)).toEqual(denied);
    expect(decidePageAccess("builder", { ...builder, builderId: null })).toEqual(denied);
    expect(decidePageAccess("builder", { ...builder, roles: ["customer"] })).toEqual(denied);
    expect(decidePageAccess("builder", admin)).toEqual(denied);
  });

  it("builder pages: an active builder or agent is let in", () => {
    expect(decidePageAccess("builder", builder)).toEqual({ allowed: true, session: builder });
  });

  it("admin pages: signed out goes to the admin sign-in", () => {
    expect(decidePageAccess("admin", null)).toEqual({ allowed: false, redirectTo: "/admin/login" });
  });

  it("admin pages: anyone else is sent home without being told why", () => {
    expect(decidePageAccess("admin", customer)).toEqual({ allowed: false, redirectTo: "/" });
    expect(decidePageAccess("admin", builder)).toEqual({ allowed: false, redirectTo: "/" });
  });

  it("admin pages: the admin is let in", () => {
    expect(decidePageAccess("admin", admin)).toEqual({ allowed: true, session: admin });
  });
});
