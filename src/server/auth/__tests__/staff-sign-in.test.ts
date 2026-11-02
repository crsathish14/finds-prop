import { describe, expect, it } from "vitest";
import {
  buildStaffCallbackUrl,
  classifyCallbackProblem,
  decideStaffLanding,
  isStaffArea,
  isStaffPathFor,
  parseStaffProblem,
  staffLoginPath,
} from "@/server/auth/staff-sign-in";
import type { SessionView } from "@/server/auth/session";

const session = (overrides: Partial<SessionView> = {}): SessionView => ({
  userId: "00000000-0000-4000-8000-000000000001",
  roles: ["customer"],
  phoneVerified: false,
  builderId: null,
  ...overrides,
});

const builder = session({ roles: ["customer", "builder"], builderId: "builder-1" });
const admin = session({ roles: ["customer", "super_admin"] });

describe("UT-staff-sign-in: where a visitor lands after Google (S3-T10)", () => {
  it("sends an active builder to the builder dashboard", () => {
    expect(decideStaffLanding("builder", builder)).toEqual({
      allowed: true,
      redirectTo: "/builder/dashboard",
    });
  });

  it("sends the administrator to the admin dashboard", () => {
    expect(decideStaffLanding("admin", admin)).toEqual({
      allowed: true,
      redirectTo: "/admin/dashboard",
    });
  });

  it("refuses a builder role without an active builder record (BR-34)", () => {
    const deactivated = session({ roles: ["customer", "builder"], builderId: null });
    expect(decideStaffLanding("builder", deactivated)).toEqual({
      allowed: false,
      problem: "denied",
      redirectTo: "/builder/login?denied=1",
    });
  });

  it("refuses a customer at both sign-in pages", () => {
    expect(decideStaffLanding("builder", session()).allowed).toBe(false);
    expect(decideStaffLanding("admin", session())).toEqual({
      allowed: false,
      problem: "denied",
      redirectTo: "/admin/login?denied=1",
    });
  });

  it("refuses a builder at the admin page and the administrator at the builder page", () => {
    expect(decideStaffLanding("admin", builder).allowed).toBe(false);
    // The administrator holds no builder record, so the builder page is closed to them too.
    expect(decideStaffLanding("builder", admin).allowed).toBe(false);
  });

  it("treats a missing session as a plain error, not a denial", () => {
    expect(decideStaffLanding("builder", null)).toEqual({
      allowed: false,
      problem: "error",
      redirectTo: "/builder/login?error=1",
    });
  });

  it("goes back to a page inside the area when the address is safe", () => {
    expect(decideStaffLanding("builder", builder, "/builder/projects?status=pending")).toEqual({
      allowed: true,
      redirectTo: "/builder/projects?status=pending",
    });
  });

  it.each([
    "/admin/dashboard",
    "/",
    "//evil.example",
    "https://evil.example/builder/dashboard",
    "/builder/login",
    "/builder/login?denied=1",
    "/builderx",
    "javascript:alert(1)",
  ])("ignores %s as a place to go back to", (next) => {
    expect(decideStaffLanding("builder", builder, next)).toEqual({
      allowed: true,
      redirectTo: "/builder/dashboard",
    });
  });
});

describe("UT-staff-sign-in: the error Supabase puts in the callback", () => {
  it("has no problem when there is no error", () => {
    expect(classifyCallbackProblem(null, null)).toBeNull();
    expect(classifyCallbackProblem(undefined, undefined)).toBeNull();
  });

  it("recognises the guard's refusal by its message", () => {
    expect(classifyCallbackProblem("server_error", "signup_not_allowed")).toBe("denied");
    expect(classifyCallbackProblem(null, "Error creating identity: signup_not_allowed")).toBe(
      "denied",
    );
  });

  it("recognises a cancelled Google screen", () => {
    expect(classifyCallbackProblem("access_denied", "The user denied access")).toBe("cancelled");
  });

  it("calls anything else an error", () => {
    expect(classifyCallbackProblem("server_error", "Database error saving new user")).toBe("error");
    expect(classifyCallbackProblem("something", null)).toBe("error");
  });
});

describe("UT-staff-sign-in: addresses and pages", () => {
  it("builds the callback address from the site address and keeps the area", () => {
    expect(buildStaffCallbackUrl("http://localhost:3000", "builder")).toBe(
      "http://localhost:3000/auth/callback?area=builder",
    );
    expect(buildStaffCallbackUrl("https://dev.example.test/", "admin")).toBe(
      "https://dev.example.test/auth/callback?area=admin",
    );
  });

  it("keeps a safe go-back address and drops an unsafe one", () => {
    const kept = new URL(
      buildStaffCallbackUrl("http://localhost:3000", "builder", "/builder/leads"),
    );
    expect(kept.searchParams.get("next")).toBe("/builder/leads");
    const dropped = new URL(
      buildStaffCallbackUrl("http://localhost:3000", "builder", "//evil.test"),
    );
    expect(dropped.searchParams.has("next")).toBe(false);
  });

  it("names the sign-in pages and their problems", () => {
    expect(staffLoginPath("builder")).toBe("/builder/login");
    expect(staffLoginPath("admin", "cancelled")).toBe("/admin/login?cancelled=1");
  });

  it("reads the problem a page was sent back with", () => {
    expect(parseStaffProblem({})).toBeNull();
    expect(parseStaffProblem({ denied: "1" })).toBe("denied");
    expect(parseStaffProblem({ cancelled: ["1"] })).toBe("cancelled");
    expect(parseStaffProblem({ error: "1" })).toBe("error");
    expect(parseStaffProblem({ denied: "yes", other: "1" })).toBeNull();
  });

  it("knows the two areas and nothing else", () => {
    expect(isStaffArea("builder")).toBe(true);
    expect(isStaffArea("admin")).toBe(true);
    expect(isStaffArea("customer")).toBe(false);
    expect(isStaffArea(undefined)).toBe(false);
    expect(isStaffPathFor("admin", "/admin")).toBe(true);
    expect(isStaffPathFor("admin", "/admin/login")).toBe(false);
  });
});
