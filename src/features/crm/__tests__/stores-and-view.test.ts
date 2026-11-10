import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: vi.fn() }));

const { crmAdminStore, crmSendStore } = await import("../service");
const { readCrmIntegrations } = await import("../queries");
const { toCrmIntegrationViews } = await import("../view");

const ID = "00000000-0000-4000-a000-000000000001";
type Failure = { code?: string; message?: string } | null;

const ROW = {
  id: ID,
  name: "Sample CRM",
  lead_source: "Find Prop",
  base_url: "https://api.crm-vendor.com",
  endpoint: "/v2/leads",
  method: "POST",
  lead_id_path: "data.lead.id",
  active: true,
  headers: { Authorization: "Bearer {{access_token}}" },
  body_mapping: { fullName: "{{name}}" },
  project_codes: { "00000000-0000-4000-b000-000000000001": "KV-01" },
  has_api_key: true,
  has_api_secret: false,
  has_access_token: true,
  forms: 2,
  created_at: "2026-11-01T10:00:00+00:00",
  updated_at: "2026-11-02T10:00:00+00:00",
};

describe("UT-crm-view: the admin's rows (S7-T09, BR-64)", () => {
  it("turns a row from the database into the screen's connection, with objects as rows", () => {
    expect(toCrmIntegrationViews([ROW])).toEqual({
      integrations: [
        {
          id: ID,
          name: "Sample CRM",
          leadSource: "Find Prop",
          baseUrl: "https://api.crm-vendor.com",
          endpoint: "/v2/leads",
          method: "POST",
          leadIdPath: "data.lead.id",
          active: true,
          headers: [{ name: "Authorization", value: "Bearer {{access_token}}" }],
          bodyMapping: [{ field: "fullName", value: "{{name}}" }],
          projectCodes: [{ projectId: "00000000-0000-4000-b000-000000000001", code: "KV-01" }],
          hasApiKey: true,
          hasApiSecret: false,
          hasAccessToken: true,
          forms: 2,
        },
      ],
      skipped: 0,
    });
  });

  it("has no place for a secret value: only whether each is set", () => {
    const [view] = toCrmIntegrationViews([
      { ...ROW, api_key: "leaked", access_token: "leaked" },
    ]).integrations;
    expect(JSON.stringify(view)).not.toContain("leaked");
    expect(Object.keys(view ?? {})).toEqual(
      expect.arrayContaining(["hasApiKey", "hasApiSecret", "hasAccessToken"]),
    );
  });

  it("leaves out and counts a row that is not in the expected shape", () => {
    const result = toCrmIntegrationViews([
      ROW,
      { ...ROW, method: "GET" },
      { ...ROW, headers: [] },
      "x",
      null,
    ]);
    expect(result.integrations).toHaveLength(1);
    expect(result.skipped).toBe(4);
    expect(toCrmIntegrationViews(null)).toEqual({ integrations: [], skipped: 0 });
  });
});

describe("UT-crm-queries: the admin's list (S7-T09)", () => {
  const clientAnswering = (answer: { data: unknown; error: Failure }) => {
    const rpc = vi.fn(async () => answer);
    return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
  };

  it("reads the list through the one admin function", async () => {
    const { client, rpc } = clientAnswering({ data: [ROW], error: null });
    expect(await readCrmIntegrations(client)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("admin_crm_integrations");
  });

  it("throws on a failed read, so the portal's error page shows it", async () => {
    const { client } = clientAnswering({ data: null, error: { code: "42501" } });
    await expect(readCrmIntegrations(client)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("UT-crm-admin-store: the calls made as the admin (S7-T09)", () => {
  const save = (answer: { data: unknown; error: Failure }) => {
    const rpc = vi.fn(async () => answer);
    return { store: crmAdminStore({ rpc } as unknown as SupabaseClient<Database>), rpc };
  };
  const ROW_TO_SAVE = {
    name: "Sample CRM",
    lead_source: null,
    base_url: "https://api.crm-vendor.com",
    endpoint: null,
    method: "POST" as const,
    lead_id_path: null,
    active: true,
    headers: {},
    body_mapping: {},
    project_codes: {},
  };

  it("makes a new connection without naming one, and sends only the secret changes", async () => {
    const { store, rpc } = save({ data: ID, error: null });
    expect(await store.save(ROW_TO_SAVE, null, { api_key: "k-1234", api_secret: null })).toEqual({
      integrationId: ID,
    });
    expect(rpc).toHaveBeenCalledWith("save_crm_integration", {
      p_values: ROW_TO_SAVE,
      p_secrets: { api_key: "k-1234", api_secret: null },
    });
  });

  it("names the connection it changes", async () => {
    const { store, rpc } = save({ data: ID, error: null });
    await store.save(ROW_TO_SAVE, ID, {});
    expect(rpc).toHaveBeenCalledWith("save_crm_integration", {
      p_values: ROW_TO_SAVE,
      p_secrets: {},
      p_integration: ID,
    });
  });

  it.each([
    [{ code: "42501", message: "crm.not_allowed" }, "FORBIDDEN"],
    [{ code: "P0002", message: "crm.not_found" }, "NOT_FOUND"],
    [{ code: "23514" }, "VALIDATION"],
    [null, "INTERNAL"],
  ])("turns the failure %j into %s", async (error, code) => {
    const { store } = save({ data: null, error });
    await expect(store.save(ROW_TO_SAVE, null, {})).rejects.toMatchObject({ code });
  });

  const remover = (answer: { data: unknown; error: Failure }) => {
    const select = vi.fn(async () => answer);
    const eq = vi.fn(() => ({ select }));
    const remove = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: remove }));
    return { store: crmAdminStore({ from } as unknown as SupabaseClient<Database>), from, eq };
  };

  it("deletes one connection by id", async () => {
    const { store, from, eq } = remover({ data: [{ id: ID }], error: null });
    expect(await store.remove(ID)).toEqual({ integrationId: ID });
    expect(from).toHaveBeenCalledWith("crm_integrations");
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it("says not found when nothing was deleted (no such connection, or the policy hid it)", async () => {
    const { store } = remover({ data: [], error: null });
    await expect(store.remove(ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("turns a failed delete into an action error", async () => {
    const { store } = remover({ data: null, error: { code: "42501" } });
    await expect(store.remove(ID)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("UT-crm-send-store: the calls made with the service role (S7-T09, BR-64)", () => {
  const CONNECTION = {
    name: "Sample CRM",
    lead_source: "Find Prop",
    base_url: "https://api.crm-vendor.com",
    endpoint: "/v2/leads",
    method: "PUT",
    lead_id_path: "id",
    headers: { "X-Api-Key": "{{api_key}}", Odd: 5 },
    body_mapping: { fullName: "{{name}}" },
    project_codes: { "00000000-0000-4000-b000-000000000001": "KV-01", Odd: 7 },
  };

  function reader(
    connection: unknown,
    secrets: unknown,
    errors: { connection?: Failure; secrets?: Failure } = {},
  ) {
    const from = vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "crm_integrations"
              ? { data: connection, error: errors.connection ?? null }
              : { data: secrets, error: errors.secrets ?? null },
        }),
      }),
    }));
    return { store: crmSendStore({ from } as unknown as SupabaseClient<Database>), from };
  }

  it("reads the connection with its secrets, keeping only text values in headers and mapping", async () => {
    const { store, from } = reader(CONNECTION, {
      api_key: "k-1",
      api_secret: null,
      access_token: "t-1",
    });
    expect(await store.readForSend(ID)).toEqual({
      name: "Sample CRM",
      connection: {
        baseUrl: "https://api.crm-vendor.com",
        endpoint: "/v2/leads",
        method: "PUT",
        leadSource: "Find Prop",
        leadIdPath: "id",
        headers: { "X-Api-Key": "{{api_key}}" },
        bodyMapping: { fullName: "{{name}}" },
      },
      projectCodes: { "00000000-0000-4000-b000-000000000001": "KV-01" },
      secrets: { apiKey: "k-1", apiSecret: null, accessToken: "t-1" },
    });
    expect(from).toHaveBeenCalledWith("crm_integration_secrets");
  });

  it("has no secrets when none are stored, and is null when there is no connection", async () => {
    const none = reader(CONNECTION, null);
    expect((await none.store.readForSend(ID))?.secrets).toEqual({
      apiKey: null,
      apiSecret: null,
      accessToken: null,
    });
    const missing = reader(null, null);
    expect(await missing.store.readForSend(ID)).toBeNull();
    expect(missing.from).not.toHaveBeenCalledWith("crm_integration_secrets");
  });

  it("falls back to POST for a method it does not know", async () => {
    const { store } = reader({ ...CONNECTION, method: "GET" }, null);
    expect((await store.readForSend(ID))?.connection.method).toBe("POST");
  });

  it("turns a failed read into an action error", async () => {
    const first = reader(CONNECTION, null, { connection: { code: "XX000" } });
    await expect(first.store.readForSend(ID)).rejects.toMatchObject({ code: "INTERNAL" });
    const second = reader(CONNECTION, null, { secrets: { code: "XX000" } });
    await expect(second.store.readForSend(ID)).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("writes one log line with no submission", async () => {
    const insert = vi.fn(async () => ({ error: null as Failure }));
    const store = crmSendStore({ from: () => ({ insert }) } as unknown as SupabaseClient<Database>);
    await store.writeLog({
      integrationId: ID,
      integrationName: "Sample CRM",
      formName: "Connection test",
      outcome: "failed",
      httpStatus: 401,
      attempt: 1,
      snippet: "invalid key ***",
    });
    expect(insert).toHaveBeenCalledWith({
      integration_id: ID,
      integration_name: "Sample CRM",
      form_name: "Connection test",
      outcome: "failed",
      http_status: 401,
      attempt: 1,
      response_snippet: "invalid key ***",
    });
  });

  it("throws when the log line cannot be written", async () => {
    const insert = vi.fn(async () => ({ error: { code: "XX000" } as Failure }));
    const store = crmSendStore({ from: () => ({ insert }) } as unknown as SupabaseClient<Database>);
    await expect(
      store.writeLog({
        integrationId: ID,
        integrationName: "Sample CRM",
        formName: "Connection test",
        outcome: "success",
        httpStatus: 200,
        attempt: 1,
        snippet: "",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
