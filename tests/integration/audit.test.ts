import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeAudit } from "@/server/audit/audit";
import type { SessionView } from "@/server/auth/session";
import { adminClient, visitorClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no header store, so the test stands in for the browser's headers.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "it-audit" }),
}));

function session(overrides: Partial<SessionView>): SessionView {
  return {
    userId: randomUUID(),
    roles: ["customer"],
    phoneVerified: true,
    builderId: null,
    ...overrides,
  };
}

async function entryFor(entityId: string) {
  const { data, error } = await adminClient()
    .from("audit_log")
    .select("*")
    .eq("entity_id", entityId)
    .single();
  if (error) throw new Error(`No audit entry for the test (${error.code})`);
  return data;
}

describe("IT-audit: writing an entry through the service", () => {
  it("records a system event with no actor and a hashed address", async () => {
    const entityId = randomUUID();
    const requestId = randomUUID();
    await writeAudit({
      action: "it.system_event",
      entity: { type: "it_test", id: entityId },
      session: null,
      requestId,
    });
    const entry = await entryFor(entityId);
    expect(entry).toMatchObject({
      actor_id: null,
      actor_role: "system",
      action: "it.system_event",
      entity_type: "it_test",
      diff: {},
      request_id: requestId,
    });
    expect(entry.ip_hash).toMatch(/^[0-9a-f]{40}$/);
    expect(entry.ip_hash).not.toContain("127.0.0.1");
  });

  it("names the actor the way the log expects: administrator, builder or customer", async () => {
    const admin = session({ roles: ["customer", "super_admin"] });
    const builder = session({ roles: ["customer", "builder"], builderId: randomUUID() });
    const customer = session({});
    for (const [actor, expected] of [
      [admin, "super_admin"],
      [builder, "builder"],
      [customer, "customer"],
    ] as const) {
      const entityId = randomUUID();
      await writeAudit({
        action: "it.actor_event",
        entity: { type: "it_test", id: entityId },
        session: actor,
        requestId: randomUUID(),
      });
      const entry = await entryFor(entityId);
      expect(entry.actor_role).toBe(expected);
      expect(entry.actor_id).toBe(actor.userId);
    }
  });

  it("refuses an action name the log would not accept, with a plain error", async () => {
    await expect(
      writeAudit({ action: "NotAValidName", session: null, requestId: randomUUID() }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("IT-audit: nobody can change or read the history without the right", () => {
  it("is append-only, even for the service role", async () => {
    const entityId = randomUUID();
    await writeAudit({
      action: "it.append_only",
      entity: { type: "it_test", id: entityId },
      session: null,
      requestId: randomUUID(),
    });
    const entry = await entryFor(entityId);

    const changed = await adminClient()
      .from("audit_log")
      .update({ action: "it.rewritten" })
      .eq("id", entry.id);
    expect(changed.error?.message).toContain("audit_log.append_only");

    const removed = await adminClient().from("audit_log").delete().eq("id", entry.id);
    expect(removed.error?.message).toContain("audit_log.append_only");

    expect((await entryFor(entityId)).action).toBe("it.append_only");
  });

  it("is closed to a visitor and to the service-only writer", async () => {
    const read = await visitorClient().from("audit_log").select("id").limit(1);
    expect(read.error).not.toBeNull();

    const write = await visitorClient().rpc("audit_record", {
      actor: randomUUID(),
      actor_kind: "customer",
      action_name: "it.forged",
      entity_kind: "it_test",
      entity_key: randomUUID(),
      change: {},
      request_key: randomUUID(),
      ip_digest: "x",
    });
    expect(write.error).not.toBeNull();
  });

  describe("as a signed-in customer", () => {
    let customer: TestUser;

    beforeAll(async () => {
      customer = await signInTestCustomer();
    });

    afterAll(removeTestUser);

    it("sees no entries (only the administrator reads the log)", async () => {
      const { data, error } = await customer.client.from("audit_log").select("id").limit(5);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("cannot write one", async () => {
      const { error } = await customer.client.rpc("audit_record", {
        actor: customer.userId,
        actor_kind: "customer",
        action_name: "it.forged",
        entity_kind: "it_test",
        entity_key: randomUUID(),
        change: {},
        request_key: randomUUID(),
        ip_digest: "x",
      });
      expect(error).not.toBeNull();
    });
  });
});
