import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("server-only", () => ({}));

const { crmAdminStore, crmSendStore } = await import("@/features/crm/service");
const { deleteIntegration, saveIntegration, testIntegration } =
  await import("@/features/crm/integration-service");
const { readCrmIntegrations } = await import("@/features/crm/queries");
const { saveIntegrationSchema } = await import("@/features/crm/schemas");
const { ActionError } = await import("@/server/actions/normalise-error");

// IT-crm (S7-T09, ADR-113): the admin's CRM connections against a real database. The save is one definer function that
// writes the settings and the secrets together and leaves the audit trail with the admin as the actor; the list
// returns only whether each secret is set; the secrets are read, with the service role, only to send a test lead.

const RUN = randomUUID().slice(0, 8);
const SECRET_KEY = `key-${RUN}-not-a-real-secret`;
const SECRET_TOKEN = `token-${RUN}-not-a-real-secret`;
const lookup = async () => ["93.184.216.34"];

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const input = (change: Record<string, unknown> = {}) =>
  saveIntegrationSchema.parse({
    name: `IT CRM ${RUN}`,
    leadSource: "Find Prop",
    baseUrl: "https://api.crm-vendor.com",
    endpoint: "/v2/leads",
    method: "POST",
    leadIdPath: "data.lead.id",
    headers: [{ name: "X-Api-Key", value: "{{api_key}}" }],
    bodyMapping: [{ field: "fullName", value: "{{name}}" }],
    ...change,
  });

describe("IT-crm: the admin's CRM connections against a real database (S7-T09, ADR-113)", () => {
  const service = adminClient();
  let staff: TestUser;
  let someone: TestUser;
  const made: string[] = [];

  const store = (user: TestUser) => crmAdminStore(user.client);

  beforeAll(async () => {
    someone = await signInTestCustomer();
    await grantRole(someone.userId, "builder");
    await createBuilderRecord(someone.userId, { active: true });
    staff = await signInTestAdmin();
  });

  afterAll(async () => {
    if (made.length > 0) {
      await service.from("crm_api_logs").delete().in("integration_id", made);
      await service.from("crm_integrations").delete().in("id", made);
    }
    await removeTestUser();
    await removeTestAdmin();
  });

  const create = async (change: Record<string, unknown> = {}) => {
    const done = await saveIntegration(store(staff), input(change), lookup);
    made.push(done.integrationId);
    return done.integrationId;
  };

  const auditOf = async (action: string, id: string) => {
    const { data, error } = await service
      .from("audit_log")
      .select("actor_id, actor_role, diff")
      .eq("action", action)
      .eq("entity_id", id);
    if (error) throw new Error(`Could not read the audit log (${error.code})`);
    return data;
  };

  const storedSecrets = async (id: string) => {
    const { data, error } = await service
      .from("crm_integration_secrets")
      .select("api_key, api_secret, access_token")
      .eq("integration_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read the secrets (${error.code})`);
    return data;
  };

  describe("saving as the signed-in administrator", () => {
    it("saves the settings and the secrets together, lists only whether each is set, and audits by name", async () => {
      const id = await create({ secrets: { apiKey: SECRET_KEY, accessToken: SECRET_TOKEN } });
      expect(await storedSecrets(id)).toEqual({
        api_key: SECRET_KEY,
        api_secret: null,
        access_token: SECRET_TOKEN,
      });

      const list = await readCrmIntegrations(staff.client);
      const found = list.find((candidate) => candidate.id === id);
      expect(found).toMatchObject({
        name: `IT CRM ${RUN}`,
        baseUrl: "https://api.crm-vendor.com",
        method: "POST",
        headers: [{ name: "X-Api-Key", value: "{{api_key}}" }],
        bodyMapping: [{ field: "fullName", value: "{{name}}" }],
        hasApiKey: true,
        hasApiSecret: false,
        hasAccessToken: true,
        forms: 0,
      });
      expect(JSON.stringify(list)).not.toContain(RUN + "-not-a-real-secret");

      const created = await auditOf("crm.created", id);
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ actor_id: staff.userId, actor_role: "super_admin" });
      const secrets = await auditOf("crm.secret_changed", id);
      expect(secrets).toHaveLength(1);
      expect(secrets[0]).toMatchObject({
        actor_id: staff.userId,
        actor_role: "super_admin",
        diff: { set: ["access_token", "api_key"] },
      });
      expect(JSON.stringify([created, secrets])).not.toContain("not-a-real-secret");
    });

    it("keeps a secret that is left out, replaces one that is given, and clears one set to null", async () => {
      const id = await create({ secrets: { apiKey: SECRET_KEY, accessToken: SECRET_TOKEN } });
      await saveIntegration(
        store(staff),
        input({ integrationId: id, name: `IT CRM ${RUN} b` }),
        lookup,
      );
      expect(await storedSecrets(id)).toMatchObject({
        api_key: SECRET_KEY,
        access_token: SECRET_TOKEN,
      });

      await saveIntegration(
        store(staff),
        input({
          integrationId: id,
          name: `IT CRM ${RUN} b`,
          secrets: {
            apiKey: `${SECRET_KEY}-2`,
            accessToken: null,
            apiSecret: "api-secret-not-real",
          },
        }),
        lookup,
      );
      expect(await storedSecrets(id)).toEqual({
        api_key: `${SECRET_KEY}-2`,
        api_secret: "api-secret-not-real",
        access_token: null,
      });
      const changes = await auditOf("crm.secret_changed", id);
      expect(changes).toHaveLength(2);
      expect(JSON.stringify(changes)).not.toContain("not-a-real-secret");
      expect(JSON.stringify(changes)).not.toContain("api-secret-not-real");
    });

    it("refuses an address that is not public before anything is stored", async () => {
      const before = (await readCrmIntegrations(staff.client)).length;
      const refused = await failureOf(() =>
        saveIntegration(
          store(staff),
          input({ name: `IT CRM ${RUN} inside`, baseUrl: "https://10.0.0.5" }),
          lookup,
        ),
      );
      expect(refused).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { baseUrl: [{ key: "validation.crmUrlNotAllowed" }] },
      });
      expect((await readCrmIntegrations(staff.client)).length).toBe(before);
    });

    it("says not found when the connection to change does not exist", async () => {
      const missing = await failureOf(() =>
        saveIntegration(
          store(staff),
          input({ integrationId: "00000000-0000-4000-a000-0000000000ff" }),
          lookup,
        ),
      );
      expect(missing.code).toBe("NOT_FOUND");
    });
  });

  describe("sending a test lead", () => {
    it("reads the secrets with the service role, sends, and logs one line without a secret in it", async () => {
      const id = await create({
        name: `IT CRM ${RUN} test`,
        secrets: { apiKey: SECRET_KEY },
      });
      const calls: { url: string; headers: Headers; body: string }[] = [];
      const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(url),
          headers: init?.headers as Headers,
          body: String(init?.body),
        });
        return new Response(`{"error":"bad key ${SECRET_KEY}"}`, { status: 401 });
      }) as typeof fetch;

      const result = await testIntegration(
        crmSendStore(service),
        { integrationId: id },
        { fetch: fetcher, lookup },
      );
      expect(result).toMatchObject({
        integrationName: `IT CRM ${RUN} test`,
        ok: false,
        status: 401,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.crm-vendor.com/v2/leads");
      expect(calls[0]?.headers.get("x-api-key")).toBe(SECRET_KEY);

      const { data, error } = await service
        .from("crm_api_logs")
        .select(
          "integration_name, form_name, outcome, http_status, attempt, response_snippet, submission_id",
        )
        .eq("integration_id", id);
      expect(error).toBeNull();
      expect(data).toEqual([
        {
          integration_name: `IT CRM ${RUN} test`,
          form_name: "Connection test",
          outcome: "failed",
          http_status: 401,
          attempt: 1,
          response_snippet: '{"error":"bad key ***"}',
          submission_id: null,
        },
      ]);
    });

    it("says not found for a connection that does not exist", async () => {
      const missing = await failureOf(() =>
        testIntegration(
          crmSendStore(service),
          { integrationId: "00000000-0000-4000-a000-0000000000ff" },
          { fetch: (async () => new Response("")) as typeof fetch, lookup },
        ),
      );
      expect(missing.code).toBe("NOT_FOUND");
    });
  });

  describe("deleting", () => {
    it("deletes a connection and its secrets, keeps its log, unlinks its forms, and audits it", async () => {
      const id = await create({ name: `IT CRM ${RUN} gone`, secrets: { apiKey: SECRET_KEY } });
      await service.from("crm_api_logs").insert({
        integration_id: id,
        integration_name: `IT CRM ${RUN} gone`,
        outcome: "success",
        http_status: 200,
      });
      const form = await service
        .from("forms")
        .insert({
          name: `IT CRM form ${RUN}`,
          slug: `it-crm-form-${RUN}`,
          kind: "enquiry",
          crm_integration_id: id,
        })
        .select("id")
        .single();
      if (form.error) throw new Error(`Could not add a form (${form.error.code})`);

      try {
        const listed = (await readCrmIntegrations(staff.client)).find(
          (candidate) => candidate.id === id,
        );
        expect(listed?.forms).toBe(1);

        expect(await deleteIntegration(store(staff), { integrationId: id })).toEqual({
          integrationId: id,
        });
        expect(await storedSecrets(id)).toBeNull();
        const stillLogged = await service
          .from("crm_api_logs")
          .select("integration_id")
          .eq("integration_name", `IT CRM ${RUN} gone`);
        expect(stillLogged.data).toEqual([{ integration_id: null }]);
        const linked = await service
          .from("forms")
          .select("crm_integration_id")
          .eq("id", form.data.id)
          .single();
        expect(linked.data).toEqual({ crm_integration_id: null });
        expect(await auditOf("crm.deleted", id)).toHaveLength(1);

        const again = await failureOf(() => deleteIntegration(store(staff), { integrationId: id }));
        expect(again.code).toBe("NOT_FOUND");
      } finally {
        await service.from("forms").delete().eq("id", form.data.id);
        await service.from("crm_api_logs").delete().eq("integration_name", `IT CRM ${RUN} gone`);
      }
    });
  });

  describe("everyone else is refused by the database", () => {
    it("refuses a builder: nothing is saved, listed or deleted", async () => {
      const id = await create({ name: `IT CRM ${RUN} guarded`, secrets: { apiKey: SECRET_KEY } });
      const saved = await failureOf(() =>
        saveIntegration(store(someone), input({ name: `IT CRM ${RUN} builder` }), lookup),
      );
      expect(saved.code).toBe("FORBIDDEN");
      const changed = await failureOf(() =>
        saveIntegration(
          store(someone),
          input({ integrationId: id, secrets: { apiKey: "stolen-not-real" } }),
          lookup,
        ),
      );
      expect(changed.code).toBe("FORBIDDEN");
      const read = await readCrmIntegrations(someone.client).catch((error: unknown) => error);
      expect(read).toMatchObject({ code: "42501" });
      // A builder's delete finds nothing to delete: only the admin's policy allows it.
      const removed = await failureOf(() =>
        deleteIntegration(store(someone), { integrationId: id }),
      );
      expect(removed.code).toBe("NOT_FOUND");
      expect(await storedSecrets(id)).toMatchObject({ api_key: SECRET_KEY });
    });
  });
});
