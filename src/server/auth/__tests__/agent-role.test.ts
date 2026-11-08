import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { assertAdmin, assertBuilder, assertUser, assertVerifiedPhone } from "../guards";
import { decidePageAccess } from "../page-access";
import { buildSessionView, type SessionView } from "../session";

// DEC-08 (S6-T06): the `agent` role is kept in the database enum and grants nothing. An account that holds it is
// treated exactly as a customer by every guard and page gate.

const claims = { sub: "00000000-0000-4000-8000-0000000000a1", phone: "919100000001" };

const agent = buildSessionView({ claims, roles: ["customer", "agent"], builderId: null });
const customer = buildSessionView({ claims, roles: ["customer"], builderId: null });

function refusal(run: () => void): string | null {
  try {
    run();
  } catch (error) {
    if (error instanceof ActionError) return error.code;
    throw error;
  }
  return null;
}

describe("UT-agent-role: an agent is a customer (S6-T06, DEC-08)", () => {
  it("reads the agent role from the account's rows, as any role", () => {
    expect(agent?.roles).toEqual(["agent", "customer"]);
    expect(customer?.roles).toEqual(["customer"]);
  });

  it("is signed in, with a verified phone, like a customer", () => {
    for (const session of [agent, customer] as SessionView[]) {
      expect(refusal(() => assertUser(session))).toBeNull();
      expect(refusal(() => assertVerifiedPhone(session))).toBeNull();
    }
  });

  it("is refused where a customer is refused: the admin guard and the builder guard", () => {
    for (const session of [agent, customer] as SessionView[]) {
      expect(refusal(() => assertAdmin(session))).toBe("FORBIDDEN");
      expect(refusal(() => assertBuilder(session))).toBe("FORBIDDEN");
    }
  });

  it("is not a builder just because a builder record exists: only the builder role counts", () => {
    const withRecord = buildSessionView({
      claims,
      roles: ["customer", "agent"],
      builderId: "00000000-0000-4000-b000-000000000001",
    });
    expect(withRecord?.builderId).toBeNull();
    expect(refusal(() => assertBuilder(withRecord))).toBe("FORBIDDEN");
  });

  it("gets the same decision as a customer on every page area", () => {
    for (const area of ["customer", "builder", "admin"] as const) {
      const forAgent = decidePageAccess(area, agent, "/dashboard");
      const forCustomer = decidePageAccess(area, customer, "/dashboard");
      expect(forAgent.allowed).toBe(forCustomer.allowed);
      if (!forAgent.allowed && !forCustomer.allowed) {
        expect(forAgent.redirectTo).toBe(forCustomer.redirectTo);
      }
    }
    expect(decidePageAccess("customer", agent).allowed).toBe(true);
    expect(decidePageAccess("builder", agent)).toEqual({
      allowed: false,
      redirectTo: "/builder/login?denied=1",
    });
    expect(decidePageAccess("admin", agent)).toEqual({ allowed: false, redirectTo: "/" });
  });

  it("an account whose only role is agent is still not an administrator", () => {
    const only = buildSessionView({ claims, roles: ["agent"], builderId: null });
    expect(refusal(() => assertAdmin(only))).toBe("FORBIDDEN");
    expect(decidePageAccess("admin", only).allowed).toBe(false);
  });
});
