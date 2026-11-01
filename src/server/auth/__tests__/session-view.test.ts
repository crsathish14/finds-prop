import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { buildSessionView } from "@/server/auth/session";

const createServerSupabase = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: () => createServerSupabase() as unknown,
}));

interface FakeOptions {
  claims?: Record<string, unknown> | null;
  claimsError?: boolean;
  roleRows?: { role: string }[];
  roleError?: boolean;
  builderId?: string | null;
  builderError?: boolean;
}

function fakeSupabase(options: FakeOptions) {
  const equalTo = vi.fn().mockResolvedValue({
    data: options.roleRows ?? [],
    error: options.roleError ? { message: "boom" } : null,
  });
  const select = vi.fn(() => ({ eq: equalTo }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({
    data: options.builderId ?? null,
    error: options.builderError ? { message: "boom" } : null,
  });
  const getClaims = vi.fn().mockResolvedValue({
    data: options.claims ? { claims: options.claims } : null,
    error: options.claimsError ? { message: "bad token" } : null,
  });
  createServerSupabase.mockResolvedValue({ auth: { getClaims }, from, rpc });
  return { equalTo, select, from, rpc, getClaims };
}

async function load() {
  const sessionModule = await import("@/server/auth/get-session-view");
  return sessionModule.getSessionView();
}

describe("UT-session-view: buildSessionView", () => {
  it("returns null without a user id", () => {
    expect(buildSessionView({ claims: {}, roles: [], builderId: null })).toBeNull();
    expect(buildSessionView({ claims: { sub: "" }, roles: [], builderId: null })).toBeNull();
  });

  it("treats only a non-empty phone claim as a verified phone", () => {
    const view = (phone: unknown) =>
      buildSessionView({ claims: { sub: "u1", phone }, roles: ["customer"], builderId: null });
    expect(view("+919000000001")?.phoneVerified).toBe(true);
    expect(view("")?.phoneVerified).toBe(false);
    expect(view(undefined)?.phoneVerified).toBe(false);
    expect(view(919000000001)?.phoneVerified).toBe(false);
  });

  it("keeps only known roles", () => {
    const view = buildSessionView({
      claims: { sub: "u1" },
      roles: ["customer", "wizard", "super_admin"],
      builderId: null,
    });
    expect(view?.roles).toEqual(["super_admin", "customer"]);
  });

  it("gives a builder record only to someone who also holds the builder role (BR-34)", () => {
    const withRole = buildSessionView({
      claims: { sub: "u1" },
      roles: ["builder"],
      builderId: "record-1",
    });
    const withoutRole = buildSessionView({
      claims: { sub: "u1" },
      roles: ["customer"],
      builderId: "record-1",
    });
    expect(withRole?.builderId).toBe("record-1");
    expect(withoutRole?.builderId).toBeNull();
  });
});

describe("UT-session-view: getSessionView", () => {
  beforeEach(() => {
    createServerSupabase.mockReset();
  });

  it("is null when nobody is signed in, and reads no rows", async () => {
    const fake = fakeSupabase({ claims: null });
    expect(await load()).toBeNull();
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("is null when the token cannot be verified", async () => {
    fakeSupabase({ claims: { sub: "u1" }, claimsError: true });
    expect(await load()).toBeNull();
  });

  it("reads this user's roles only, never everyone's", async () => {
    const fake = fakeSupabase({
      claims: { sub: "u1", phone: "+919000000001" },
      roleRows: [{ role: "customer" }],
    });
    const view = await load();
    expect(fake.from).toHaveBeenCalledWith("user_roles");
    expect(fake.select).toHaveBeenCalledWith("role");
    expect(fake.equalTo).toHaveBeenCalledWith("user_id", "u1");
    expect(view).toEqual({
      userId: "u1",
      roles: ["customer"],
      phoneVerified: true,
      builderId: null,
    });
  });

  it("reports an active builder, and an agent the same way", async () => {
    fakeSupabase({
      claims: { sub: "b1", phone: "" },
      roleRows: [{ role: "customer" }, { role: "builder" }],
      builderId: "record-1",
    });
    expect(await load()).toMatchObject({ phoneVerified: false, builderId: "record-1" });
  });

  it("reports no builder record for a deactivated builder", async () => {
    fakeSupabase({
      claims: { sub: "b1" },
      roleRows: [{ role: "builder" }],
      builderId: null,
    });
    expect(await load()).toMatchObject({ roles: ["builder"], builderId: null });
  });

  it("fails with INTERNAL when the roles cannot be read", async () => {
    fakeSupabase({ claims: { sub: "u1" }, roleError: true });
    await expect(load()).rejects.toBeInstanceOf(ActionError);
    fakeSupabase({ claims: { sub: "u1" }, builderError: true });
    await expect(load()).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
