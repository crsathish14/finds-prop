import { describe, expect, it } from "vitest";
import { ActionError, toFailure } from "@/server/actions/normalise-error";
import { assertAdmin, assertBuilder, assertUser, assertVerifiedPhone } from "@/server/auth/guards";
import type { SessionView } from "@/server/auth/session";

const customer: SessionView = {
  userId: "u1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const noPhone: SessionView = { ...customer, phoneVerified: false };
const builder: SessionView = {
  ...customer,
  roles: ["builder", "customer"],
  phoneVerified: false,
  builderId: "record-1",
};
const admin: SessionView = { ...customer, roles: ["super_admin", "customer"] };

function failure(run: () => void): ActionError {
  try {
    run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the guard to refuse");
}

describe("UT-guards (plan 07 section 4.1)", () => {
  it("assertUser: signed out is UNAUTHENTICATED", () => {
    expect(failure(() => assertUser(null)).code).toBe("UNAUTHENTICATED");
    expect(() => assertUser(customer)).not.toThrow();
  });

  it("assertVerifiedPhone: signed out is UNAUTHENTICATED, no phone is FORBIDDEN with a reason", () => {
    expect(failure(() => assertVerifiedPhone(null)).code).toBe("UNAUTHENTICATED");
    const refusal = failure(() => assertVerifiedPhone(noPhone));
    expect(refusal.code).toBe("FORBIDDEN");
    expect(refusal.reason).toBe("PHONE_NOT_VERIFIED");
    expect(() => assertVerifiedPhone(customer)).not.toThrow();
  });

  it("assertVerifiedPhone: a builder or agent has no phone, so customer actions are refused", () => {
    expect(failure(() => assertVerifiedPhone(builder)).reason).toBe("PHONE_NOT_VERIFIED");
  });

  it("assertAdmin: only super_admin passes", () => {
    expect(failure(() => assertAdmin(null)).code).toBe("UNAUTHENTICATED");
    expect(failure(() => assertAdmin(customer)).code).toBe("FORBIDDEN");
    expect(failure(() => assertAdmin(builder)).code).toBe("FORBIDDEN");
    expect(() => assertAdmin(admin)).not.toThrow();
  });

  it("assertBuilder: needs the role and an active record (BR-34)", () => {
    expect(failure(() => assertBuilder(null)).code).toBe("UNAUTHENTICATED");
    expect(failure(() => assertBuilder(customer)).code).toBe("FORBIDDEN");
    expect(failure(() => assertBuilder({ ...builder, builderId: null })).code).toBe("FORBIDDEN");
    expect(failure(() => assertBuilder({ ...builder, roles: ["customer"] })).code).toBe(
      "FORBIDDEN",
    );
    expect(() => assertBuilder(builder)).not.toThrow();
  });

  it("assertBuilder: the admin is not a builder", () => {
    expect(failure(() => assertBuilder(admin)).code).toBe("FORBIDDEN");
  });

  it("what reaches the browser is a code only, never the developer message", () => {
    expect(toFailure(failure(() => assertAdmin(customer)))).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(toFailure(failure(() => assertVerifiedPhone(noPhone)))).toEqual({
      ok: false,
      code: "FORBIDDEN",
      reason: "PHONE_NOT_VERIFIED",
    });
    expect(toFailure(failure(() => assertUser(null)))).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});
