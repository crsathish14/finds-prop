import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
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

const { leadStore } = await import("@/features/leads/service");
const { changeLeadStatus } = await import("@/features/leads/lead-service");
const { readFilterOptions, readLeadCounts, readLeadsPage, readSubmissionsPage } =
  await import("@/features/leads/queries");
const { leadFilterSchema, setLeadStatusSchema, submissionFilterSchema } =
  await import("@/features/leads/schemas");
const { ActionError } = await import("@/server/actions/normalise-error");

const RUN = randomUUID().slice(0, 8);
const SOURCE = `it-leads-${RUN}`;
const LEADS = 27;
const MINUTE = 60 * 1000;

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-leads: the admin's leads and form submissions against a real database (S7-T07, FR-ADM-06)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let builder: TestUser;
  let projectId: string;
  let formId: string;
  const leadIds: string[] = [];

  const lead = async (id: string) => {
    const { data, error } = await admin
      .from("project_leads")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read the lead (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    staff = await signInTestAdmin();
    builder = await signInTestCustomer();
    await grantRole(builder.userId, "builder");
    const builderId = await createBuilderRecord(builder.userId, { active: true });
    const project = await admin
      .from("projects")
      .insert({
        slug: `it-leads-${RUN}`,
        name: `Leads Integration Project ${RUN}`,
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

    const form = await admin
      .from("forms")
      .insert({
        name: `IT leads form ${RUN}`,
        slug: `it-leads-form-${RUN}`,
        kind: "enquiry",
        fields: [
          { label: "Budget", key: "budget", type: "text" },
          { label: "What they want", key: "wants", type: "checkbox", options: ["Parking", "Gym"] },
        ],
      })
      .select("id")
      .single();
    if (form.error) throw new Error(`Could not create the form (${form.error.code})`);
    formId = form.data.id;

    // 27 leads, one minute apart, the first five already contacted.
    const base = Date.now() - 3 * 60 * MINUTE;
    const inserted = await admin
      .from("project_leads")
      .insert(
        Array.from({ length: LEADS }, (_unused, index) => ({
          project_id: projectId,
          kind: "enquiry" as const,
          name: `Lead ${String(index).padStart(2, "0")} ${RUN}`,
          phone: "9841055512",
          status: index < 5 ? ("contacted" as const) : ("new" as const),
          created_at: new Date(base + index * MINUTE).toISOString(),
        })),
      )
      .select("id");
    if (inserted.error) throw new Error(`Could not add the leads (${inserted.error.code})`);
    leadIds.push(...inserted.data.map((row) => row.id));

    const day = 24 * 60 * MINUTE;
    // Every row names the same columns: a column one row leaves out is sent as null, not as its default.
    const submissions = await admin.from("form_submissions").insert([
      {
        form_id: formId,
        form_name: `IT leads form ${RUN}`,
        project_id: projectId,
        name: "Priya Raman",
        mobile: "9840012345",
        data: { budget: "1 Cr", wants: ["Parking", "Gym"], note: "old key" },
        source: SOURCE,
        crm_status: "failed" as const,
        crm_http_status: 502,
        crm_attempts: 2,
        last_error: "HTTP 502",
        created_at: new Date(Date.now() - 1 * day).toISOString(),
      },
      {
        form_id: formId,
        form_name: `IT leads form ${RUN}`,
        project_id: projectId,
        name: "Anand V",
        mobile: "9962011876",
        data: { budget: "80 L" },
        source: SOURCE,
        crm_status: "failed" as const,
        crm_http_status: 500,
        crm_attempts: 1,
        created_at: new Date(Date.now() - 2 * day).toISOString(),
      },
      {
        form_id: formId,
        form_name: `IT leads form ${RUN}`,
        name: "Meena S",
        mobile: "9841070011",
        data: {},
        source: SOURCE,
        crm_status: "success" as const,
        crm_attempts: 1,
        crm_lead_id: "CRM-4817",
        created_at: new Date(Date.now() - 3 * day).toISOString(),
      },
      {
        form_id: formId,
        form_name: `IT leads form ${RUN}`,
        name: "Vikram R",
        mobile: "9710130920",
        data: {},
        source: SOURCE,
        crm_status: "not_applicable" as const,
        crm_attempts: 0,
        created_at: new Date(Date.now() - 40 * day).toISOString(),
      },
    ]);
    if (submissions.error) {
      throw new Error(`Could not add the submissions (${submissions.error.code})`);
    }
  });

  afterAll(async () => {
    await admin.from("form_submissions").delete().eq("form_id", formId);
    await admin.from("project_leads").delete().eq("project_id", projectId);
    await admin.from("forms").delete().eq("id", formId);
    await admin.from("projects").delete().eq("id", projectId);
    await removeTestUser();
    await removeTestAdmin();
  });

  describe("the leads list", () => {
    const filters = (extra: Record<string, unknown> = {}) =>
      leadFilterSchema.parse({ project: projectId, ...extra });

    it("reads a page of 25 newest first, says how many there are in all, and gives the cursor for the rest", async () => {
      const first = await readLeadsPage(staff.client, filters());
      expect(first.leads).toHaveLength(25);
      expect(first.total).toBe(LEADS);
      expect(first.nextCursor).not.toBeNull();
      expect(first.leads[0]?.name).toBe(`Lead 26 ${RUN}`);
      expect(first.leads[0]?.projectName).toBe(`Leads Integration Project ${RUN}`);
      const times = first.leads.map((row) => Date.parse(row.createdAt));
      expect([...times].sort((later, earlier) => earlier - later)).toEqual(times);
    });

    it("reads the rest after the cursor, with no lead twice and none missed", async () => {
      const first = await readLeadsPage(staff.client, filters());
      const second = await readLeadsPage(
        staff.client,
        filters({ after: first.nextCursor ?? undefined }),
      );
      expect(second.leads).toHaveLength(2);
      expect(second.nextCursor).toBeNull();
      const all = [...first.leads, ...second.leads].map((row) => row.id);
      expect(new Set(all).size).toBe(LEADS);
      expect(all.sort()).toEqual([...leadIds].sort());
    });

    it("filters by state and by project", async () => {
      expect((await readLeadsPage(staff.client, filters({ status: "contacted" }))).total).toBe(5);
      expect((await readLeadsPage(staff.client, filters({ status: "closed" }))).total).toBe(0);
      expect(
        (await readLeadsPage(staff.client, leadFilterSchema.parse({ project: randomUUID() })))
          .total,
      ).toBe(0);
    });

    it("lets the project's own builder read its leads", async () => {
      const own = await readLeadsPage(builder.client, filters());
      expect(own.total).toBe(LEADS);
      expect(own.leads.every((row) => row.projectId === projectId)).toBe(true);
    });

    it("refuses a visitor who is not signed in: the table is closed to them", async () => {
      await expect(readLeadsPage(visitorClient(), filters())).rejects.toMatchObject({
        code: "42501",
      });
    });
  });

  describe("changing a lead's state", () => {
    const set = (client: TestUser["client"], leadId: string, status: string) =>
      changeLeadStatus(leadStore(client), setLeadStatusSchema.parse({ leadId, status }));

    it("sets the state as the admin, and answers the project", async () => {
      const [target] = leadIds;
      if (!target) throw new Error("no lead");
      expect(await set(staff.client, target, "closed")).toEqual({
        leadId: target,
        projectId,
        status: "closed",
      });
      expect(await lead(target)).toEqual({ status: "closed" });
    });

    it("says not found for a lead that is not there", async () => {
      expect(await failureOf(() => set(staff.client, randomUUID(), "new"))).toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("lets the project's builder change the state of their own lead, which is why the same store serves the builder portal later", async () => {
      const target = leadIds[1];
      if (!target) throw new Error("no lead");
      expect((await set(builder.client, target, "contacted")).status).toBe("contacted");
    });

    it("refuses a visitor who is not signed in (the database, not the action, says no)", async () => {
      const target = leadIds[2];
      if (!target) throw new Error("no lead");
      expect(await failureOf(() => set(visitorClient(), target, "closed"))).toMatchObject({
        code: "FORBIDDEN",
      });
      expect(await lead(target)).toEqual({ status: "contacted" });
    });
  });

  describe("the form submissions list", () => {
    const now = new Date();
    const filters = (extra: Record<string, unknown> = {}) =>
      submissionFilterSchema.parse({ form: formId, ...extra });

    it("reads the last 30 days of a form by default, newest first, with the answers labelled by the form's own questions", async () => {
      const page = await readSubmissionsPage(staff.client, filters(), now);
      expect(page.total).toBe(3);
      expect(page.submissions.map((row) => row.name)).toEqual([
        "Priya Raman",
        "Anand V",
        "Meena S",
      ]);
      const [first] = page.submissions;
      expect(first).toMatchObject({
        formName: `IT leads form ${RUN}`,
        projectName: `Leads Integration Project ${RUN}`,
        source: SOURCE,
        crm: { status: "failed", httpStatus: 502, attempts: 2, lastError: "HTTP 502" },
      });
      expect(first?.answers).toEqual([
        { key: "budget", label: "Budget", value: "1 Cr" },
        { key: "wants", label: "What they want", value: ["Parking", "Gym"] },
        { key: "note", label: "note", value: "old key" },
      ]);
    });

    it("reaches back past 30 days when asked for all of it", async () => {
      expect((await readSubmissionsPage(staff.client, filters({ range: "all" }), now)).total).toBe(
        4,
      );
      expect((await readSubmissionsPage(staff.client, filters({ range: "90" }), now)).total).toBe(
        4,
      );
      expect((await readSubmissionsPage(staff.client, filters({ range: "7" }), now)).total).toBe(3);
    });

    it("filters by CRM state, project and source", async () => {
      const failed = await readSubmissionsPage(staff.client, filters({ crm: "failed" }), now);
      expect(failed.total).toBe(2);
      expect(
        (await readSubmissionsPage(staff.client, filters({ crm: "success" }), now)).submissions[0]
          ?.crm.leadId,
      ).toBe("CRM-4817");
      expect(
        (await readSubmissionsPage(staff.client, filters({ project: projectId }), now)).total,
      ).toBe(2);
      expect(
        (await readSubmissionsPage(staff.client, filters({ source: "nowhere" }), now)).total,
      ).toBe(0);
    });

    it("shows nothing to a builder and refuses a visitor: only the admin reads submissions", async () => {
      expect((await readSubmissionsPage(builder.client, filters(), now)).total).toBe(0);
      await expect(readSubmissionsPage(visitorClient(), filters(), now)).rejects.toMatchObject({
        code: "42501",
      });
    });
  });

  it("counts every lead and every submission for the tabs, whatever the filters (the database is shared, so at least ours)", async () => {
    const counts = await readLeadCounts(staff.client);
    expect(counts.leads).toBeGreaterThanOrEqual(LEADS);
    expect(counts.submissions).toBeGreaterThanOrEqual(4);
  });

  it("counts nothing of submissions for a builder, and refuses a visitor", async () => {
    expect((await readLeadCounts(builder.client)).submissions).toBe(0);
    await expect(readLeadCounts(visitorClient())).rejects.toMatchObject({ code: "42501" });
  });

  it("offers the project, the form and the source to filter by", async () => {
    const options = await readFilterOptions(staff.client);
    expect(options.projects).toContainEqual({
      id: projectId,
      name: `Leads Integration Project ${RUN}`,
    });
    expect(options.forms).toContainEqual({ id: formId, name: `IT leads form ${RUN}` });
    expect(options.sources).toContain(SOURCE);
  });
});
