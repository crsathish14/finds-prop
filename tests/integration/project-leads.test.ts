import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestUser,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no header store; the service only needs one to hash the caller.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { createProjectWriteStore } = await import("@/features/projects/service");

const VISITOR = "d".repeat(40);
const OTHER_VISITOR = "e".repeat(40);
const SLUG = `it-project-${randomUUID().slice(0, 8)}`;

describe("IT-project-leads: the lead and event functions against a real database (S4-T09 step D)", () => {
  let user: TestUser;
  let projectId: string;
  const store = createProjectWriteStore(randomUUID());

  beforeAll(async () => {
    user = await signInTestCustomer();
    await grantRole(user.userId, "builder");
    const builderId = await createBuilderRecord(user.userId, { active: true });
    const { data, error } = await adminClient()
      .from("projects")
      .insert({
        slug: SLUG,
        name: "Integration Test Project",
        builder_id: builderId,
        locality: "Integration Test Locality",
        moderation: "approved",
        published: true,
        moderated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the test project (${error.code})`);
    projectId = data.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("project_leads").delete().eq("project_id", projectId);
    await admin.from("project_events").delete().eq("project_id", projectId);
    await admin.from("projects").delete().eq("id", projectId);
    await removeTestUser();
  });

  it("stores an enquiry with the account's phone and the visitor hash, and nothing else about the caller", async () => {
    const id = await store.insertLead({
      slug: SLUG,
      kind: "enquiry",
      name: "Priya Raman",
      phone: "919900000001",
      email: "priya@example.test",
      message: "Is a 3 BHK left?",
      visitDate: null,
      visitor: VISITOR,
    });
    const { data, error } = await adminClient()
      .from("project_leads")
      .select("project_id, kind, name, phone, email, message, visit_date, status, visitor_hash")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      project_id: projectId,
      kind: "enquiry",
      name: "Priya Raman",
      phone: "919900000001",
      email: "priya@example.test",
      message: "Is a 3 BHK left?",
      visit_date: null,
      status: "new",
      visitor_hash: VISITOR,
    });
  });

  it("stores a site visit with its date", async () => {
    const visitDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const id = await store.insertLead({
      slug: SLUG,
      kind: "site_visit",
      name: "Arun Kumar",
      phone: "919900000001",
      email: null,
      message: null,
      visitDate,
      visitor: VISITOR,
    });
    const { data } = await adminClient()
      .from("project_leads")
      .select("kind, visit_date")
      .eq("id", id)
      .single();
    expect(data).toEqual({ kind: "site_visit", visit_date: visitDate });
  });

  it("refuses a visit date in the past with the field's own problem", async () => {
    await expect(
      store.insertLead({
        slug: SLUG,
        kind: "site_visit",
        name: "Late Visitor",
        phone: "919900000001",
        email: null,
        message: null,
        visitDate: "2020-01-01",
        visitor: VISITOR,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { visitDate: [{ key: "validation.visitDateRange" }] },
    });
  });

  it("takes no lead for a project that is not there, or not published", async () => {
    const lead = {
      kind: "enquiry" as const,
      name: "Nobody Home",
      phone: "919900000001",
      email: null,
      message: null,
      visitDate: null,
      visitor: VISITOR,
    };
    await expect(store.insertLead({ ...lead, slug: "it-no-such-project" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await adminClient().from("projects").update({ published: false }).eq("id", projectId);
    await expect(store.insertLead({ ...lead, slug: SLUG })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await adminClient().from("projects").update({ published: true }).eq("id", projectId);
  });

  it("records one view per visitor per hour, and another visitor's view separately", async () => {
    const row = { slug: SLUG, event: "view", visitor: VISITOR };
    expect(await store.recordEvent(row)).toBe(true);
    expect(await store.recordEvent(row)).toBe(false);
    expect(await store.recordEvent({ ...row, visitor: OTHER_VISITOR })).toBe(true);
    const { count } = await adminClient()
      .from("project_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("event_type", "view");
    expect(count).toBe(2);
  });

  it("records two views at once from one visitor as a single view", async () => {
    const visitor = "f".repeat(40);
    const answers = await Promise.all([
      store.recordEvent({ slug: SLUG, event: "view", visitor }),
      store.recordEvent({ slug: SLUG, event: "view", visitor }),
      store.recordEvent({ slug: SLUG, event: "view", visitor }),
    ]);
    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it("records nothing, and raises nothing, for a project nobody can see", async () => {
    expect(
      await store.recordEvent({ slug: "it-no-such-project", event: "view", visitor: VISITOR }),
    ).toBe(false);
  });

  it("cannot be called by anyone with the publishable key, signed in or not", async () => {
    const lead = {
      p_slug: SLUG,
      p_kind: "enquiry",
      p_name: "Sneaky Caller",
      p_phone: "919900000001",
      p_visitor_hash: VISITOR,
    };
    for (const client of [visitorClient(), user.client]) {
      const asLead = await client.rpc("submit_project_lead", lead);
      expect(asLead.error?.code).toBe("42501");
      const asEvent = await client.rpc("track_project_event", {
        p_slug: SLUG,
        p_event_type: "view",
        p_visitor_hash: VISITOR,
      });
      expect(asEvent.error?.code).toBe("42501");
    }
  });
});
