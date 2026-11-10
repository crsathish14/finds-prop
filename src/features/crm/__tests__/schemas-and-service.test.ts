import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { toFieldErrors } from "@/server/actions/field-errors";
import {
  addressRefused,
  deleteIntegration,
  mapCrmError,
  saveIntegration,
  testIntegration,
  TEST_LEAD,
  toCrmRow,
  toSecretChanges,
  type CrmAdminStore,
  type CrmSendStore,
} from "../integration-service";
import { saveIntegrationSchema } from "../schemas";

const ID = "00000000-0000-4000-a000-000000000001";
const PROJECT = "00000000-0000-4000-b000-000000000001";
const lookup = async () => ["93.184.216.34"];

const VALID = {
  name: "Sample CRM",
  leadSource: "Find Prop",
  baseUrl: "https://api.crm-vendor.com",
  endpoint: "/v2/leads",
  method: "POST",
  leadIdPath: "data.lead.id",
  active: true,
  headers: [{ name: "Authorization", value: "Bearer {{access_token}}" }],
  bodyMapping: [{ field: "fullName", value: "{{name}}" }],
  projectCodes: [{ projectId: PROJECT, code: "KV-01" }],
};

const parse = (input: unknown) => saveIntegrationSchema.safeParse(input);
const errorsOf = (input: unknown) => {
  const result = parse(input);
  if (result.success) throw new Error("expected the input to be refused");
  return toFieldErrors(result.error, input);
};

describe("UT-crm-schema: what the admin's CRM screen may send (S7-T09)", () => {
  it("accepts a full connection and turns the rows into the table's objects", () => {
    const result = parse({ ...VALID, integrationId: ID.toUpperCase() });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.integrationId).toBe(ID);
    expect(toCrmRow(result.data)).toEqual({
      name: "Sample CRM",
      lead_source: "Find Prop",
      base_url: "https://api.crm-vendor.com",
      endpoint: "/v2/leads",
      method: "POST",
      lead_id_path: "data.lead.id",
      active: true,
      headers: { Authorization: "Bearer {{access_token}}" },
      body_mapping: { fullName: "{{name}}" },
      project_codes: { [PROJECT]: "KV-01" },
    });
  });

  it("needs only a name, an address and a method; the rest is empty or off", () => {
    const result = parse({
      name: "Backup CRM",
      baseUrl: "https://hooks.backup.io/lead",
      method: "PUT",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(toCrmRow(result.data)).toMatchObject({
      lead_source: null,
      endpoint: null,
      lead_id_path: null,
      active: true,
      headers: {},
      body_mapping: {},
      project_codes: {},
    });
  });

  it("clears the optional boxes that are left blank", () => {
    const result = parse({ ...VALID, leadSource: "  ", endpoint: "", leadIdPath: "" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(toCrmRow(result.data)).toMatchObject({
      lead_source: null,
      endpoint: null,
      lead_id_path: null,
    });
  });

  it.each([
    [
      "an address that is not https",
      { baseUrl: "http://api.crm-vendor.com" },
      "baseUrl",
      "validation.crmUrlNotAllowed",
    ],
    ["an address with no host", { baseUrl: "https://" }, "baseUrl", "validation.crmUrlNotAllowed"],
    [
      "an address with a space",
      { baseUrl: "https://api.crm vendor.com" },
      "baseUrl",
      "validation.crmUrlNotAllowed",
    ],
    ["a blank address", { baseUrl: " " }, "baseUrl", "validation.required"],
    ["a GET method", { method: "GET" }, "method", "validation.invalid"],
    ["an endpoint without a slash", { endpoint: "v2/leads" }, "endpoint", "validation.invalid"],
    [
      "a lead id path with brackets",
      { leadIdPath: "data[0].id" },
      "leadIdPath",
      "validation.invalid",
    ],
    ["a one-letter name", { name: "A" }, "name", "validation.required"],
  ])("refuses %s on the right box", (_what, change, field, key) => {
    expect(errorsOf({ ...VALID, ...change })[field]).toEqual([{ key }]);
  });

  it.each([
    ["Host", "host"],
    ["Content-Length", "content-length"],
    ["Transfer-Encoding", "transfer-encoding"],
  ])("refuses the server's own header %s", (name) => {
    expect(errorsOf({ ...VALID, headers: [{ name, value: "x" }] })["headers.0.name"]).toEqual([
      { key: "validation.invalid" },
    ]);
  });

  it("refuses a header name with a space or a colon, and a value with a line break", () => {
    expect(
      errorsOf({ ...VALID, headers: [{ name: "Bad Name", value: "x" }] })["headers.0.name"],
    ).toBeDefined();
    expect(
      errorsOf({ ...VALID, headers: [{ name: "A:B", value: "x" }] })["headers.0.name"],
    ).toBeDefined();
    expect(
      errorsOf({ ...VALID, headers: [{ name: "X-A", value: "a\nb" }] })["headers.0.value"],
    ).toBeDefined();
  });

  it("points at the second row when a header, a mapping or a project repeats", () => {
    const errors = errorsOf({
      ...VALID,
      headers: [
        { name: "X-A", value: "1" },
        { name: "x-a", value: "2" },
      ],
      bodyMapping: [
        { field: "phone", value: "{{mobile}}" },
        { field: "phone", value: "{{mobile}}" },
      ],
      projectCodes: [
        { projectId: PROJECT, code: "A" },
        { projectId: PROJECT, code: "B" },
      ],
    });
    expect(errors["headers.1.name"]).toEqual([{ key: "validation.localityLabelTaken" }]);
    expect(errors["bodyMapping.1.field"]).toEqual([{ key: "validation.localityLabelTaken" }]);
    expect(errors["projectCodes.1.projectId"]).toEqual([{ key: "validation.localityLabelTaken" }]);
  });

  it("refuses too many rows and a project code that is not for a project", () => {
    const many = Array.from({ length: 31 }, (_row, index) => ({ name: `X-${index}`, value: "v" }));
    expect(errorsOf({ ...VALID, headers: many })["headers"]).toBeDefined();
    expect(
      errorsOf({ ...VALID, projectCodes: [{ projectId: "kadal-vista", code: "A" }] })[
        "projectCodes.0.projectId"
      ],
    ).toBeDefined();
  });

  it("reads each secret as: left alone, set, or cleared", () => {
    const changes = (secrets: unknown) => {
      const result = parse({ ...VALID, secrets });
      if (!result.success) throw new Error("expected the input to be accepted");
      return toSecretChanges(result.data.secrets);
    };
    expect(changes(undefined)).toEqual({});
    expect(changes({})).toEqual({});
    expect(changes({ apiKey: "", apiSecret: "   " })).toEqual({});
    expect(changes({ apiKey: " new-key ", apiSecret: null, accessToken: undefined })).toEqual({
      api_key: "new-key",
      api_secret: null,
    });
  });

  it("refuses a secret that is too long, has a line break, or is not text", () => {
    expect(
      errorsOf({ ...VALID, secrets: { apiKey: "k".repeat(2001) } })["secrets.apiKey"],
    ).toBeDefined();
    expect(errorsOf({ ...VALID, secrets: { apiKey: "a\nb" } })["secrets.apiKey"]).toBeDefined();
    expect(errorsOf({ ...VALID, secrets: { apiKey: 5 } })["secrets.apiKey"]).toBeDefined();
  });
});

describe("UT-crm-service: saving, deleting and testing a connection (S7-T09)", () => {
  const savedInput = () => {
    const result = parse({ ...VALID, secrets: { apiKey: "k-1234" } });
    if (!result.success) throw new Error("expected the input to be accepted");
    return result.data;
  };

  it("saves a new connection with its secret changes, once the address passes", async () => {
    const save = vi.fn(async () => ({ integrationId: ID }));
    const store: CrmAdminStore = { save, remove: vi.fn() };
    expect(await saveIntegration(store, savedInput(), lookup)).toEqual({ integrationId: ID });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ base_url: "https://api.crm-vendor.com" }),
      null,
      {
        api_key: "k-1234",
      },
    );
  });

  it("saves changes to the connection it was told", async () => {
    const asked: (string | null)[] = [];
    const save = async (_row: unknown, integrationId: string | null) => {
      asked.push(integrationId);
      return { integrationId: ID };
    };
    await saveIntegration(
      { save, remove: vi.fn() },
      { ...savedInput(), integrationId: ID },
      lookup,
    );
    expect(asked).toEqual([ID]);
  });

  it.each([
    ["a name that leads inside", "https://crm.vendor.com", async () => ["10.0.0.5"]],
    ["a name that does not resolve", "https://crm.vendor.com", async () => []],
    ["an internal address", "https://192.168.0.10", lookup],
  ])(
    "stores nothing for %s, and puts the message on the address box",
    async (_what, baseUrl, find) => {
      const save = vi.fn();
      const failure = await saveIntegration(
        { save, remove: vi.fn() },
        { ...savedInput(), baseUrl },
        find,
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ActionError);
      expect(failure).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { baseUrl: [{ key: "validation.crmUrlNotAllowed" }] },
      });
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("checks the address with the endpoint on the end", async () => {
    const asked: string[] = [];
    await saveIntegration(
      { save: vi.fn(async () => ({ integrationId: ID })), remove: vi.fn() },
      savedInput(),
      async (host) => {
        asked.push(host);
        return ["93.184.216.34"];
      },
    );
    expect(asked).toEqual(["api.crm-vendor.com"]);
  });

  it("passes a delete to the store", async () => {
    const remove = vi.fn(async () => ({ integrationId: ID }));
    await deleteIntegration({ save: vi.fn(), remove }, { integrationId: ID });
    expect(remove).toHaveBeenCalledWith(ID);
  });

  it("has the same message for a refused address wherever it comes from", () => {
    expect(addressRefused()).toMatchObject({ code: "VALIDATION" });
  });

  it.each([
    [{ code: "42501" }, "FORBIDDEN"],
    [{ message: "crm.not_allowed" }, "FORBIDDEN"],
    [{ code: "P0002" }, "NOT_FOUND"],
    [{ code: "PGRST116" }, "NOT_FOUND"],
    [{ message: "crm.not_found" }, "NOT_FOUND"],
    [{ code: "23514" }, "VALIDATION"],
    [{ code: "22023", message: "crm.bad_secret" }, "VALIDATION"],
    [{ code: "XX000", message: "secret detail" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s, and never repeats the database's text", (failure, code) => {
    const error = mapCrmError(failure);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain("secret detail");
  });
});

describe("UT-crm-test: the test lead (S7-T09)", () => {
  const found = {
    name: "Sample CRM",
    connection: {
      baseUrl: "https://api.crm-vendor.com",
      endpoint: "/v2/leads",
      method: "POST" as const,
      leadSource: null,
      leadIdPath: null,
      headers: { "X-Api-Key": "{{api_key}}" },
      bodyMapping: { fullName: "{{name}}", note: "{{message}}" },
    },
    secrets: { apiKey: "fake-key-for-tests", apiSecret: null, accessToken: null },
  };
  const storeWith = (read: typeof found | null) => {
    const writeLog = vi.fn(async () => undefined);
    const store: CrmSendStore = { readForSend: vi.fn(async () => read), writeLog };
    return { store, writeLog };
  };

  it("sends the test lead, logs one line without a submission, and answers only the outcome", async () => {
    const { store, writeLog } = storeWith(found);
    const fetcher = vi.fn(
      async () => new Response('{"ok":true}', { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await testIntegration(store, { integrationId: ID }, { fetch: fetcher, lookup });
    expect(result).toEqual({
      integrationName: "Sample CRM",
      ok: true,
      status: 200,
      durationMs: expect.any(Number),
    });
    const body = JSON.parse(String((vi.mocked(fetcher).mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({ fullName: TEST_LEAD["name"], note: TEST_LEAD["message"] });
    expect(writeLog).toHaveBeenCalledWith({
      integrationId: ID,
      integrationName: "Sample CRM",
      formName: "Connection test",
      outcome: "success",
      httpStatus: 200,
      attempt: 1,
      snippet: '{"ok":true}',
    });
  });

  it("logs a failure with the CRM's status, and leaves the secret out of the line", async () => {
    const { store, writeLog } = storeWith(found);
    const fetcher = vi.fn(
      async () => new Response("invalid key fake-key-for-tests", { status: 401 }),
    ) as unknown as typeof fetch;
    const result = await testIntegration(store, { integrationId: ID }, { fetch: fetcher, lookup });
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", httpStatus: 401, snippet: "invalid key ***" }),
    );
    expect(JSON.stringify(result)).not.toContain("fake-key-for-tests");
  });

  it("logs a call that was never made, with no status", async () => {
    const { store, writeLog } = storeWith({
      ...found,
      connection: { ...found.connection, baseUrl: "https://10.0.0.5" },
    });
    const fetcher = vi.fn() as unknown as typeof fetch;
    const result = await testIntegration(store, { integrationId: ID }, { fetch: fetcher, lookup });
    expect(result).toMatchObject({ ok: false, status: null });
    expect(fetcher).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", httpStatus: null }),
    );
  });

  it("says not found for a connection that is gone, and logs nothing", async () => {
    const { store, writeLog } = storeWith(null);
    const failure = await testIntegration(
      store,
      { integrationId: ID },
      { fetch: vi.fn() as unknown as typeof fetch, lookup },
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "NOT_FOUND" });
    expect(writeLog).not.toHaveBeenCalled();
  });

  it("carries no real person's details", () => {
    expect(JSON.stringify(TEST_LEAD)).toMatch(/test/i);
    expect(TEST_LEAD["email"]).toMatch(/\.invalid$/);
  });
});
