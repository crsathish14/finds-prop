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

const { projectModerationStore } = await import("@/features/project-moderation/service");
const { applyDecision, removeProject } =
  await import("@/features/project-moderation/moderation-service");
const { readAdminProjects } = await import("@/features/project-moderation/queries");
const { ActionError } = await import("@/server/actions/normalise-error");

// IT-project-moderation (S7-T04, ADR-100): the admin's decisions on projects against a real database. The decisions
// are one definer function (the guard trigger keeps the moderation columns for the system), the delete is the admin's
// policy plus the lead foreign key (BR-44), and the list is a definer function that checks the admin itself.

const RUN = randomUUID().slice(0, 8);

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-project-moderation: the admin's projects and decisions against a real database (S7-T04, ADR-100)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let someone: TestUser;
  let builderId: string;
  const made: string[] = [];

  const store = (user: TestUser) => projectModerationStore(user.client);

  const newProject = async (
    state: Partial<{
      moderation: "pending" | "approved" | "rejected";
      published: boolean;
      featured: boolean;
    }> = {},
  ) => {
    const moderation = state.moderation ?? "pending";
    const { data, error } = await admin
      .from("projects")
      .insert({
        slug: `it-moderation-${randomUUID()}`,
        name: `Moderation Project ${RUN}`,
        builder_id: builderId,
        locality: `Moderation Town ${RUN}`,
        moderation,
        published: state.published ?? false,
        featured: state.featured ?? false,
        ...(moderation === "rejected" ? { rejection_reason: "Not ready." } : {}),
        ...(moderation === "pending" ? {} : { moderated_at: new Date().toISOString() }),
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(`Could not create a project (${error.code})`);
    made.push(data.id);
    return data;
  };

  const row = async (projectId: string) => {
    const { data, error } = await admin.from("projects").select("*").eq("id", projectId).single();
    if (error) throw new Error(`Could not read the project (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    someone = await signInTestCustomer();
    await grantRole(someone.userId, "builder");
    builderId = await createBuilderRecord(someone.userId, { active: true });
    staff = await signInTestAdmin();
  });

  afterAll(async () => {
    if (made.length > 0) {
      await admin.from("project_leads").delete().in("project_id", made);
      await admin.from("projects").delete().in("id", made);
    }
    await removeTestUser();
    await removeTestAdmin();
  });

  describe("decisions as the signed-in administrator", () => {
    it("approves a pending project and answers what the page needs to refresh its cache tags", async () => {
      const project = await newProject();
      const done = await applyDecision(store(staff), {
        projectId: project.id,
        decision: "approve",
      });
      expect(done).toEqual({
        projectId: project.id,
        slug: project.slug,
        moderation: "approved",
        published: false,
        featured: false,
      });
      expect(await row(project.id)).toMatchObject({
        moderation: "approved",
        rejection_reason: null,
        moderated_by: staff.userId,
      });
    });

    it("rejects a pending project with a fixed reason, takes it off the site, and records the change with the admin as actor", async () => {
      const project = await newProject({ published: true, featured: true });
      const done = await applyDecision(store(staff), {
        projectId: project.id,
        decision: "reject",
      });
      expect(done).toMatchObject({ moderation: "rejected", published: false, featured: false });
      expect(await row(project.id)).toMatchObject({
        moderation: "rejected",
        rejection_reason: "Rejected by an admin.",
        moderated_by: staff.userId,
      });
      const { data, error } = await admin
        .from("audit_log")
        .select("actor_id, actor_role, diff")
        .eq("entity_id", project.id)
        .eq("action", "project.moderation_changed");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]).toMatchObject({
        actor_id: staff.userId,
        actor_role: "super_admin",
        diff: { from: "pending", to: "rejected", published: false, featured: false },
      });
    });

    it("approves a rejected project later, and clears the reason", async () => {
      const project = await newProject({ moderation: "rejected" });
      await applyDecision(store(staff), { projectId: project.id, decision: "approve" });
      expect(await row(project.id)).toMatchObject({
        moderation: "approved",
        rejection_reason: null,
      });
    });

    it("publishes and unpublishes an approved project, and features and unfeatures it", async () => {
      const project = await newProject({ moderation: "approved" });
      const step = (decision: "publish" | "unpublish" | "feature" | "unfeature") =>
        applyDecision(store(staff), { projectId: project.id, decision });
      expect(await step("publish")).toMatchObject({ published: true, featured: false });
      expect(await step("feature")).toMatchObject({ published: true, featured: true });
      expect(await step("unfeature")).toMatchObject({ featured: false });
      expect(await step("unpublish")).toMatchObject({ published: false });
      expect(await row(project.id)).toMatchObject({ moderation: "approved", published: false });
    });

    it("says conflict when the project is not in the state the decision needs, and changes nothing", async () => {
      const pending = await newProject();
      const approved = await newProject({ moderation: "approved" });
      const attempts = [
        () => applyDecision(store(staff), { projectId: pending.id, decision: "publish" }),
        () => applyDecision(store(staff), { projectId: pending.id, decision: "feature" }),
        () => applyDecision(store(staff), { projectId: pending.id, decision: "unpublish" }),
        () => applyDecision(store(staff), { projectId: approved.id, decision: "approve" }),
        () => applyDecision(store(staff), { projectId: approved.id, decision: "reject" }),
        () => applyDecision(store(staff), { projectId: approved.id, decision: "unfeature" }),
      ];
      for (const attempt of attempts) {
        expect((await failureOf(attempt)).code).toBe("CONFLICT");
      }
      expect(await row(pending.id)).toMatchObject({ moderation: "pending", published: false });
      expect(await row(approved.id)).toMatchObject({ moderation: "approved", featured: false });
    });

    it("says not found for a project that does not exist", async () => {
      const error = await failureOf(() =>
        applyDecision(store(staff), { projectId: randomUUID(), decision: "approve" }),
      );
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("deleting", () => {
    it("deletes a project with no leads, and gives back its address", async () => {
      const project = await newProject();
      const done = await removeProject(store(staff), { projectId: project.id });
      expect(done).toEqual({ projectId: project.id, slug: project.slug });
      const { data } = await admin.from("projects").select("id").eq("id", project.id);
      expect(data).toEqual([]);
    });

    it("refuses to delete a project that has leads, and the project stays (BR-44)", async () => {
      const project = await newProject({ moderation: "approved", published: true });
      const lead = await admin.from("project_leads").insert({
        project_id: project.id,
        kind: "enquiry" as const,
        name: "Arjun Menon",
        phone: "9841055512",
      });
      if (lead.error) throw new Error(`Could not add a lead (${lead.error.code})`);
      const error = await failureOf(() => removeProject(store(staff), { projectId: project.id }));
      expect(error.code).toBe("CONFLICT");
      expect(await row(project.id)).toMatchObject({ moderation: "approved", published: true });
    });

    it("says not found for a project that does not exist", async () => {
      const error = await failureOf(() => removeProject(store(staff), { projectId: randomUUID() }));
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("the admin's list", () => {
    it("lists every project with its builder's name and number of leads", async () => {
      const project = await newProject({ moderation: "approved", published: true });
      const leads = await admin.from("project_leads").insert([
        {
          project_id: project.id,
          kind: "enquiry" as const,
          name: "Arjun Menon",
          phone: "9841055512",
        },
        { project_id: project.id, kind: "brochure" as const, name: "Divya K", phone: "9884021098" },
      ]);
      if (leads.error) throw new Error(`Could not add leads (${leads.error.code})`);
      const list = await readAdminProjects(staff.client);
      const found = list.projects.find((candidate) => candidate.id === project.id);
      expect(found).toMatchObject({
        name: `Moderation Project ${RUN}`,
        builderId,
        builderName: "Integration Test Builder",
        moderation: "approved",
        published: true,
        leads: 2,
      });
    });
  });

  describe("everyone else is refused by the database", () => {
    it("refuses a builder, even for their own project: nothing changes", async () => {
      const project = await newProject();
      const decided = await failureOf(() =>
        applyDecision(store(someone), { projectId: project.id, decision: "approve" }),
      );
      expect(decided.code).toBe("FORBIDDEN");
      const read = await readAdminProjects(someone.client).catch((error: unknown) => error);
      expect(read).toMatchObject({ code: "42501" });
      // A builder's delete finds nothing to delete: only the admin's policy allows it.
      const removed = await failureOf(() =>
        removeProject(store(someone), { projectId: project.id }),
      );
      expect(removed.code).toBe("NOT_FOUND");
      expect(await row(project.id)).toMatchObject({ moderation: "pending" });
    });
  });
});
