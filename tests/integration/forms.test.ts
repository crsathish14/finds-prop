import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestUser,
  signInTestCustomer,
} from "./support/users";

// Outside a request there is no header store; the service only needs one to hash the caller.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { createFormWriteStore } = await import("@/features/forms/service");
const { submitFormValues } = await import("@/features/forms/form-service");
const { submitFormSchema } = await import("@/features/forms/schemas");

const RUN = randomUUID().slice(0, 8);
const VISITOR = "e".repeat(40);
const FIELDS = [
  { label: "Your name", key: "name", type: "text", required: true },
  { label: "Mobile", key: "mobile", type: "text", required: true },
  { label: "Message", key: "message", type: "textarea" },
];

describe("IT-forms: record_form_submission against a real database (S5-T05, BR-60 to BR-63)", () => {
  const formIds: string[] = [];
  let projectId: string;
  const store = createFormWriteStore(randomUUID());
  const slugs = {
    contact: `it-contact-${RUN}`,
    project: `it-project-form-${RUN}`,
    inactive: `it-inactive-${RUN}`,
    project_slug: `it-form-project-${RUN}`,
  };

  async function addForm(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await adminClient()
      .from("forms")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the form (${error.code})`);
    formIds.push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    const user = await signInTestCustomer();
    await grantRole(user.userId, "builder");
    const builderId = await createBuilderRecord(user.userId, { active: true });
    const project = await adminClient()
      .from("projects")
      .insert({
        slug: slugs.project_slug,
        name: "Integration Form Project",
        builder_id: builderId,
        locality: "Integration Test Locality",
        moderation: "approved",
        published: true,
        moderated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (project.error) throw new Error(`Could not create the project (${project.error.code})`);
    projectId = project.data.id;
    await addForm({
      name: "IT contact",
      slug: slugs.contact,
      kind: "contact",
      placement: "contact",
      fields: FIELDS,
    });
    await addForm({
      name: "IT project",
      slug: slugs.project,
      kind: "enquiry",
      placement: "project",
      fields: FIELDS,
    });
    await addForm({
      name: "IT inactive",
      slug: slugs.inactive,
      kind: "contact",
      placement: "contact",
      fields: FIELDS,
      active: false,
    });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("form_submissions").delete().in("form_id", formIds);
    await admin.from("project_leads").delete().eq("project_id", projectId);
    await admin.from("forms").delete().in("id", formIds);
    await admin.from("projects").delete().eq("id", projectId);
    await removeTestUser();
  });

  const send = (overrides: Record<string, unknown>) =>
    submitFormValues(store, {
      input: submitFormSchema.parse({
        formSlug: slugs.contact,
        values: { name: "Priya Raman", mobile: "98400 12345", message: "Hello" },
        source: "/contact",
        idempotencyKey: randomUUID(),
        ...overrides,
      }),
      visitor: VISITOR,
    });

  it("reads the active form as a visitor, without its CRM link", async () => {
    const form = await store.readForm(slugs.contact);
    expect(form.found).toBe(true);
    expect(JSON.stringify(form.row)).not.toContain("crm");
    expect((await store.readForm(slugs.inactive)).found).toBe(false);
  });

  it("stores a validated submission with its columns, data, source and visitor", async () => {
    const { submissionId } = await send({});
    const { data, error } = await adminClient()
      .from("form_submissions")
      .select("form_name, name, mobile, email, data, source, visitor_hash, crm_status, project_id")
      .eq("id", submissionId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      form_name: "IT contact",
      name: "Priya Raman",
      mobile: "9840012345",
      email: null,
      data: { message: "Hello" },
      source: "/contact",
      visitor_hash: VISITOR,
      crm_status: "not_applicable",
      project_id: null,
    });
  });

  it("returns the first submission for a repeat with the same key", async () => {
    const idempotencyKey = randomUUID();
    const first = await send({ idempotencyKey });
    const second = await send({ idempotencyKey });
    expect(second.submissionId).toBe(first.submissionId);
  });

  it("refuses wrong answers before anything is stored, and an inactive form as not found", async () => {
    await expect(send({ values: { name: "P", mobile: "1" } })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(send({ formSlug: slugs.inactive })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("mirrors a project page form into project_leads with the project it was filled in on (BR-63)", async () => {
    const { submissionId } = await send({
      formSlug: slugs.project,
      projectSlug: slugs.project_slug,
      source: `/projects/${slugs.project_slug}`,
    });
    const { data } = await adminClient()
      .from("form_submissions")
      .select("project_id, project_lead_id")
      .eq("id", submissionId)
      .single();
    expect(data?.project_id).toBe(projectId);
    const lead = await adminClient()
      .from("project_leads")
      .select("kind, name, phone, message, project_id")
      .eq("id", data?.project_lead_id ?? "")
      .single();
    expect(lead.data).toEqual({
      kind: "enquiry",
      name: "Priya Raman",
      phone: "9840012345",
      message: "Hello",
      project_id: projectId,
    });
  });

  it("cannot be called by an anonymous visitor directly, and the submissions are not readable by one", async () => {
    const visitor = visitorClient();
    const call = await visitor.rpc("record_form_submission", {
      p_form_slug: slugs.contact,
      p_visitor_hash: VISITOR,
    });
    expect(call.error).not.toBeNull();
    const read = await visitor.from("form_submissions").select("id").limit(1);
    expect(read.data ?? []).toEqual([]);
  });
});
