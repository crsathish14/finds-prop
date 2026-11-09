import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";
import {
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
vi.mock("@/features/units", () => ({ getProjectOptions: vi.fn() }));

const { formBuilderStore } = await import("@/features/form-builder/service");
const { createForm, deleteFormById, duplicateForm, saveForm, switchForm } =
  await import("@/features/form-builder/builder-service");
const { createFormSchema, updateFormSchema } = await import("@/features/form-builder/schemas");
const { readFormBuilderData } = await import("@/features/form-builder/queries");
const { ActionError } = await import("@/server/actions/normalise-error");

// IT-form-builder (S7-T08, ADR-104): the admin's form builder against a real database. The table's policies let
// only the super admin write forms and read the CRM link; the slug is unique; a project is set only for "one
// project"; deleting a form keeps the submissions and lets the projects fall back.

const RUN = randomUUID().slice(0, 8);
const slugOf = (label: string) => `it-form-${label}-${RUN}`;

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-form-builder: the admin's forms against a real database (S7-T08, ADR-104)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let someone: TestUser;
  const made: string[] = [];

  const store = (user: TestUser) => formBuilderStore(user.client);

  const input = (label: string, extra: Record<string, unknown> = {}) => ({
    name: `Integration form ${label} ${RUN}`,
    slug: slugOf(label),
    kind: "enquiry",
    placement: "none",
    fields: [
      { label: "Name", key: "name", type: "text", required: true },
      { label: "Mobile", key: "mobile", type: "text", required: true },
      { label: "City", key: "city", type: "dropdown", options: ["Chennai", "Madurai"] },
    ],
    ...extra,
  });

  const row = async (formId: string) => {
    const { data, error } = await admin.from("forms").select("*").eq("id", formId).single();
    if (error) throw new Error(`Could not read the form (${error.code})`);
    return data;
  };

  const make = async (label: string, extra: Record<string, unknown> = {}) => {
    const done = await createForm(store(staff), createFormSchema.parse(input(label, extra)));
    made.push(done.formId);
    return done;
  };

  beforeAll(async () => {
    someone = await signInTestCustomer();
    staff = await signInTestAdmin();
  });

  afterAll(async () => {
    if (made.length > 0) await admin.from("forms").delete().in("id", made);
    await admin.from("forms").delete().like("slug", `it-form-%-${RUN}%`);
    await removeTestUser();
    await removeTestAdmin();
  });

  describe("as the signed-in administrator", () => {
    it("creates a form with its fields in order, and gives back its id and slug", async () => {
      const done = await make("create", { buttonText: "Send", successMessage: "Thank you." });
      expect(done.slug).toBe(slugOf("create"));
      expect(await row(done.formId)).toMatchObject({
        slug: slugOf("create"),
        kind: "enquiry",
        placement: "none",
        button_text: "Send",
        success_message: "Thank you.",
        active: true,
        project_id: null,
        crm_integration_id: null,
      });
      const stored = (await row(done.formId)).fields as { key: string }[];
      expect(stored.map((field) => field.key)).toEqual(["name", "mobile", "city"]);
    });

    it("refuses a second form with the same slug, on the slug box", async () => {
      const first = await make("same");
      const error = await failureOf(() =>
        createForm(store(staff), createFormSchema.parse(input("same"))),
      );
      expect(error).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { slug: [{ key: "validation.formSlugTaken" }] },
      });
      expect(first.formId).toBeTruthy();
    });

    it("saves changes to a form: the fields, the placement and a project for 'one project'", async () => {
      const project = await admin
        .from("projects")
        .insert({
          slug: `it-form-project-${RUN}`,
          name: `Form Project ${RUN}`,
          builder_id: await builderId(),
          locality: "Form Town",
        })
        .select("id")
        .single();
      if (project.error) throw new Error(`Could not add a project (${project.error.code})`);
      try {
        const done = await make("save");
        await saveForm(
          store(staff),
          updateFormSchema.parse({
            ...input("save", {
              placement: "project_specific",
              projectId: project.data.id,
              fields: [{ label: "Name", key: "name", type: "text" }],
            }),
            formId: done.formId,
          }),
        );
        expect(await row(done.formId)).toMatchObject({
          placement: "project_specific",
          project_id: project.data.id,
        });
        // Back to a placement that has no project: the project is let go.
        await saveForm(
          store(staff),
          updateFormSchema.parse({
            ...input("save", { placement: "contact", projectId: project.data.id }),
            formId: done.formId,
          }),
        );
        expect(await row(done.formId)).toMatchObject({ placement: "contact", project_id: null });
      } finally {
        await admin.from("forms").update({ project_id: null }).eq("project_id", project.data.id);
        await admin.from("projects").delete().eq("id", project.data.id);
      }
    });

    it("says not found when it saves, switches or deletes a form that does not exist", async () => {
      const ghost = randomUUID();
      expect(
        (
          await failureOf(() =>
            saveForm(store(staff), updateFormSchema.parse({ ...input("ghost"), formId: ghost })),
          )
        ).code,
      ).toBe("NOT_FOUND");
      expect(
        (await failureOf(() => switchForm(store(staff), { formId: ghost, active: false }))).code,
      ).toBe("NOT_FOUND");
      expect((await failureOf(() => deleteFormById(store(staff), { formId: ghost }))).code).toBe(
        "NOT_FOUND",
      );
    });

    it("switches a form off and on", async () => {
      const done = await make("switch");
      await switchForm(store(staff), { formId: done.formId, active: false });
      expect((await row(done.formId)).active).toBe(false);
      await switchForm(store(staff), { formId: done.formId, active: true });
      expect((await row(done.formId)).active).toBe(true);
    });

    it("duplicates a form under a new name and slug, switched off, and numbers the next copy", async () => {
      const original = await make("copy", { active: true, buttonText: "Go" });
      const first = await duplicateForm(store(staff), { formId: original.formId });
      made.push(first.formId);
      expect(first.slug).toBe(`${slugOf("copy")}-copy`);
      expect(await row(first.formId)).toMatchObject({
        name: `Integration form copy ${RUN} (copy)`,
        active: false,
        button_text: "Go",
        kind: "enquiry",
      });
      const second = await duplicateForm(store(staff), { formId: original.formId });
      made.push(second.formId);
      expect(second.slug).toBe(`${slugOf("copy")}-copy-2`);
      expect((await row(second.formId)).fields).toEqual((await row(original.formId)).fields);
    });

    it("deletes a form, keeps the submissions made with it and records the deletion with the admin as actor", async () => {
      const done = await make("delete");
      const submission = await admin
        .from("form_submissions")
        .insert({
          form_id: done.formId,
          form_name: `Integration form delete ${RUN}`,
          name: "Arjun",
        })
        .select("id")
        .single();
      if (submission.error)
        throw new Error(`Could not add a submission (${submission.error.code})`);
      try {
        await deleteFormById(store(staff), { formId: done.formId });
        const { data } = await admin.from("forms").select("id").eq("id", done.formId);
        expect(data).toEqual([]);
        const kept = await admin
          .from("form_submissions")
          .select("id, form_id, form_name")
          .eq("id", submission.data.id)
          .single();
        expect(kept.data).toMatchObject({
          form_id: null,
          form_name: `Integration form delete ${RUN}`,
        });
        const audit = await admin
          .from("audit_log")
          .select("actor_id, actor_role")
          .eq("entity_id", done.formId)
          .eq("action", "form.deleted");
        expect(audit.data).toHaveLength(1);
        expect(audit.data?.[0]).toMatchObject({
          actor_id: staff.userId,
          actor_role: "super_admin",
        });
      } finally {
        await admin.from("form_submissions").delete().eq("id", submission.data.id);
      }
    });

    it("lists the forms, newest change first, with their CRM link", async () => {
      const crm = await admin
        .from("crm_integrations")
        .insert({
          name: `Form CRM ${RUN}`,
          base_url: "https://crm.example.test",
          endpoint: "/leads",
          lead_source: "findsprop",
        })
        .select("id")
        .single();
      if (crm.error) throw new Error(`Could not add an integration (${crm.error.code})`);
      try {
        const done = await make("list", { crmIntegrationId: crm.data.id });
        const data = await readFormBuilderData(staff.client, []);
        const found = data.forms.find((form) => form.id === done.formId);
        expect(found).toMatchObject({ crmIntegrationId: crm.data.id, crmName: `Form CRM ${RUN}` });
        expect(found?.fields.map((field) => field.key)).toEqual(["name", "mobile", "city"]);
        expect(data.integrations.some((entry) => entry.id === crm.data.id)).toBe(true);
      } finally {
        await admin
          .from("forms")
          .update({ crm_integration_id: null })
          .eq("crm_integration_id", crm.data.id);
        await admin.from("crm_integrations").delete().eq("id", crm.data.id);
      }
    });
  });

  describe("everyone else is refused by the database", () => {
    it("refuses a signed-in customer every write, and shows them none of the admin's list", async () => {
      const target = await make("refused");
      const created = await failureOf(() =>
        createForm(store(someone), createFormSchema.parse(input("customer"))),
      );
      expect(created.code).toBe("FORBIDDEN");
      // An update or delete finds no row a customer may touch.
      expect(
        (
          await failureOf(() =>
            saveForm(
              store(someone),
              updateFormSchema.parse({
                ...input("refused", { name: "Changed" }),
                formId: target.formId,
              }),
            ),
          )
        ).code,
      ).toBe("NOT_FOUND");
      expect(
        (await failureOf(() => deleteFormById(store(someone), { formId: target.formId }))).code,
      ).toBe("NOT_FOUND");
      expect(await row(target.formId)).toMatchObject({ name: `Integration form refused ${RUN}` });
      // The admin's list and the integrations' names are empty for anyone else: nothing leaks.
      const list = await readFormBuilderData(someone.client, []);
      expect(list.forms).toEqual([]);
      expect(list.integrations).toEqual([]);
    });
  });

  /** A builder record to own the project the 'one project' test uses. */
  async function builderId(): Promise<string> {
    const { data, error } = await admin
      .from("builders")
      .insert({ email: `it-form-${RUN}@example.test`, name: `Form Builder ${RUN}` })
      .select("id")
      .single();
    if (error) throw new Error(`Could not add a builder (${error.code})`);
    cleanupBuilders.push(data.id);
    return data.id;
  }
  const cleanupBuilders: string[] = [];
  afterAll(async () => {
    if (cleanupBuilders.length > 0) await admin.from("builders").delete().in("id", cleanupBuilders);
  });
});
