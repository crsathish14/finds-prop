import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/features/units", () => ({ getProjectOptions: vi.fn() }));

const { readFormBuilderData } = await import("../queries");
const { formBuilderStore } = await import("../service");
const { readFields, toAdminForms } = await import("../view");

const FORM = "00000000-0000-4000-b000-000000000002";
const PROJECT = "00000000-0000-4000-b000-000000000001";
const CRM = "00000000-0000-4000-b000-0000000000c1";

const stored = (extra: Record<string, unknown> = {}) => ({
  id: FORM,
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  project_id: null,
  crm_integration_id: null,
  button_text: "Send message",
  success_message: null,
  fields: [{ label: "Name", key: "name", type: "text", required: true }],
  active: true,
  created_at: "2026-11-01T00:00:00+00:00",
  updated_at: "2026-11-02T00:00:00+00:00",
  ...extra,
});

describe("UT-form-builder-view: the admin's forms (S7-T08)", () => {
  it("keeps the stored fields that fit the shape and counts the ones that do not", () => {
    const result = readFields([
      { label: "Name", key: "name", type: "text", required: true },
      { label: "", key: "bad", type: "text" },
      { label: "Odd", key: "odd", type: "hologram" },
    ]);
    expect(result.fields).toHaveLength(1);
    expect(result.skipped).toBe(2);
    expect(readFields("nonsense")).toEqual({ fields: [], skipped: 0 });
  });

  it("names the project and the CRM integration a form points at, and falls back for an unknown kind or placement", () => {
    const [view] = toAdminForms(
      [
        stored({
          project_id: PROJECT,
          crm_integration_id: CRM,
          placement: "project_specific",
          kind: "mystery",
        }),
      ],
      {
        projects: [{ id: PROJECT, name: "Kadal Vista" }],
        integrations: [{ id: CRM, name: "Sample CRM" }],
      },
    );
    expect(view).toMatchObject({
      projectName: "Kadal Vista",
      crmName: "Sample CRM",
      placement: "project_specific",
      kind: "enquiry",
      skippedFields: 0,
    });
    const [plain] = toAdminForms([stored({ placement: "elsewhere" })], {
      projects: [],
      integrations: [],
    });
    expect(plain).toMatchObject({ placement: "none", projectName: null, crmName: null });
  });
});

describe("UT-form-builder-queries: reading the forms as the admin (S7-T08)", () => {
  function reading(
    forms: { data: unknown; error: { code?: string } | null },
    crm = { data: [], error: null as { code?: string } | null },
  ) {
    const order = vi.fn(async () => crm);
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn(async () => forms);
    return { client: { rpc, from } as unknown as SupabaseClient<Database>, rpc, from, select };
  }

  it("lists the newest change first, with the names of the integrations", async () => {
    const older = stored({ id: "older", updated_at: "2026-10-01T00:00:00+00:00", name: "Old" });
    const { client, rpc, from, select } = reading(
      { data: [older, stored()], error: null },
      { data: [{ id: CRM, name: "Sample CRM" }] as never, error: null },
    );
    const data = await readFormBuilderData(client, [{ id: PROJECT, name: "Kadal Vista" }]);
    expect(rpc).toHaveBeenCalledWith("admin_forms");
    expect(from).toHaveBeenCalledWith("crm_integrations");
    expect(select).toHaveBeenCalledWith("id, name");
    expect(data.forms.map((form) => form.name)).toEqual(["Contact", "Old"]);
    expect(data.integrations).toEqual([{ id: CRM, name: "Sample CRM" }]);
    expect(data.projects).toEqual([{ id: PROJECT, name: "Kadal Vista" }]);
  });

  it("throws when the database says no, so the portal's error page shows it", async () => {
    const refused = reading({ data: null, error: { code: "42501" } });
    await expect(readFormBuilderData(refused.client, [])).rejects.toMatchObject({ code: "42501" });
  });
});

describe("UT-form-builder-store: the calls made as the admin (S7-T08)", () => {
  function writing(answer: { data: unknown; error: { code?: string } | null }) {
    const single = vi.fn(async () => answer);
    const select = vi.fn(() => ({ single, then: undefined }));
    const eq = vi.fn(() => ({ select: vi.fn(async () => answer) }));
    const insert = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const remove = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ insert, update, delete: remove }));
    return { client: { from } as unknown as SupabaseClient<Database>, insert, update, eq };
  }

  const row = {
    name: "Contact",
    slug: "contact",
    kind: "contact",
    placement: "contact",
    project_id: null,
    crm_integration_id: null,
    button_text: null,
    success_message: null,
    fields: [],
    active: true,
  };

  it("inserts a form and gives back its id and slug", async () => {
    const { client, insert } = writing({ data: { id: FORM, slug: "contact" }, error: null });
    expect(await formBuilderStore(client).insert(row)).toEqual({ formId: FORM, slug: "contact" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ slug: "contact", active: true }));
  });

  it("says the slug is taken when the database says it is", async () => {
    const { client } = writing({ data: null, error: { code: "23505" } });
    await expect(formBuilderStore(client).insert(row)).rejects.toMatchObject({
      fieldErrors: { slug: [{ key: "validation.formSlugTaken" }] },
    });
  });

  it("updates by id and says not found when nothing changed", async () => {
    const found = writing({ data: [{ id: FORM, slug: "contact" }], error: null });
    expect(await formBuilderStore(found.client).update(FORM, row)).toEqual({
      formId: FORM,
      slug: "contact",
    });
    expect(found.eq).toHaveBeenCalledWith("id", FORM);
    const nothing = writing({ data: [], error: null });
    await expect(formBuilderStore(nothing.client).update(FORM, row)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(formBuilderStore(nothing.client).remove(FORM)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(formBuilderStore(nothing.client).setActive(FORM, false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reads one form through the admin's list, with its CRM link, and gives null when it is not there", async () => {
    const rpc = vi.fn(async () => ({ data: [stored({ crm_integration_id: CRM })], error: null }));
    const store = formBuilderStore({ rpc } as unknown as SupabaseClient<Database>);
    expect(await store.read(FORM)).toMatchObject({ slug: "contact", crm_integration_id: CRM });
    expect(await store.read("other")).toBeNull();
  });
});
