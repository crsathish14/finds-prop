import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/server/auth/session";

const rpc = vi.fn();
const createAdminSupabase = vi.fn();
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));
const incomingHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(incomingHeaders) }));
const environment: { RATE_LIMIT_HMAC_SECRET?: string; APP_ENV: string } = {
  RATE_LIMIT_HMAC_SECRET: "a-test-secret-that-is-at-least-32-characters-long",
  APP_ENV: "production",
};
vi.mock("@/server/env", () => ({ env: environment }));

const customer: SessionView = {
  userId: "u1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const builder: SessionView = { ...customer, roles: ["builder", "customer"], builderId: "b-1" };
const admin: SessionView = { ...customer, roles: ["super_admin", "customer"] };

async function load() {
  return await import("@/server/audit/audit");
}

describe("UT-audit: who the log names", () => {
  it("names the actor kind the database accepts", async () => {
    const { actorKind } = await load();
    expect(actorKind(null)).toBe("system");
    expect(actorKind(customer)).toBe("customer");
    expect(actorKind(builder)).toBe("builder");
    expect(actorKind(admin)).toBe("super_admin");
    expect(actorKind({ ...builder, roles: ["builder", "super_admin"] })).toBe("super_admin");
  });
});

describe("UT-audit: writeAudit", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    createAdminSupabase.mockReset().mockReturnValue({ rpc });
    incomingHeaders.set("x-vercel-forwarded-for", "203.0.113.7");
    environment.RATE_LIMIT_HMAC_SECRET = "a-test-secret-that-is-at-least-32-characters-long";
    environment.APP_ENV = "production";
  });

  it("writes through audit_record with the actor, the request id and a hashed address", async () => {
    const { writeAudit } = await load();
    await writeAudit({
      action: "staff.signed_in",
      entity: { type: "user", id: "u1" },
      session: admin,
      requestId: "req-12345678",
    });
    expect(createAdminSupabase).toHaveBeenCalledWith("req-12345678");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("audit_record");
    expect(args).toMatchObject({
      actor: "u1",
      actor_kind: "super_admin",
      action_name: "staff.signed_in",
      entity_kind: "user",
      entity_key: "u1",
      change: {},
      request_key: "req-12345678",
    });
    expect(String(args.ip_digest)).toMatch(/^[0-9a-f]{40}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.7");
  });

  it("records an event with no signed-in user as a system event", async () => {
    const { writeAudit } = await load();
    await writeAudit({ action: "cms.published", session: null, requestId: "req-12345678" });
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).toMatchObject({
      actor: null,
      actor_kind: "system",
      entity_kind: "action",
      entity_key: null,
    });
  });

  it("stores no address hash at all when the secret is missing", async () => {
    delete environment.RATE_LIMIT_HMAC_SECRET;
    const { writeAudit } = await load();
    await writeAudit({ action: "cms.published", session: admin, requestId: "req-12345678" });
    expect((rpc.mock.calls[0]?.[1] as Record<string, unknown>).ip_digest).toBeNull();
  });

  it("fails when the database refuses the entry, so the pipeline can log it", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    const { writeAudit } = await load();
    await expect(
      writeAudit({ action: "cms.published", session: admin, requestId: "req-12345678" }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
