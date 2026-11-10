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

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("server-only", () => ({}));

const { readCrmLogs } = await import("@/features/crm/queries");
const { readSubmissionsPage } = await import("@/features/leads/queries");
const { submissionFilterSchema } = await import("@/features/leads/schemas");

// IT-crm-page (S7-T09 part D1): what the admin's CRM page and Leads page read, against a real database. The API logs
// come with a note of which submissions are failed right now, so Retry is offered only on the newest line of such a
// submission; the Leads list names the CRM connection that took each submission. Only the admin reads either.

const RUN = randomUUID().slice(0, 8);
// The lines are dated a little ahead of now, so they are the newest in the log whatever else the database holds.
const NEWEST = Date.now() + 60_000;

describe("IT-crm-page: the API logs and the Agent column against a real database (S7-T09 D1)", () => {
  const service = adminClient();
  let staff: TestUser;
  let someone: TestUser;
  let integrationId: string;
  let formId: string;
  const submissions: string[] = [];

  const submit = async () => {
    const { data, error } = await service.rpc("record_form_submission", {
      p_form_slug: `it-page-${RUN}`,
      p_visitor_hash: "a".repeat(40),
      p_name: "Priya Raman",
      p_mobile: "9840012345",
      p_data: { message: `hello ${RUN}` },
      p_idempotency_key: randomUUID(),
    });
    if (error || typeof data !== "string")
      throw new Error(`Could not store a submission (${error?.code})`);
    submissions.push(data);
    return data;
  };

  const setState = async (id: string, crmStatus: "failed" | "success" | "pending") => {
    const { error } = await service
      .from("form_submissions")
      .update({ crm_status: crmStatus })
      .eq("id", id);
    if (error) throw new Error(`Could not set the state (${error.code})`);
  };

  const addLine = async (
    submissionId: string | null,
    outcome: "success" | "failed",
    attempt: number,
    secondsLater: number,
  ) => {
    const { error } = await service.from("crm_api_logs").insert({
      integration_id: integrationId,
      integration_name: `IT Page ${RUN}`,
      submission_id: submissionId,
      form_name: submissionId ? `IT Page form ${RUN}` : "Connection test",
      outcome,
      http_status: outcome === "success" ? 200 : 502,
      attempt,
      response_snippet: outcome === "success" ? '{"ok":true}' : "Bad gateway",
      created_at: new Date(NEWEST + secondsLater * 1000).toISOString(),
    });
    if (error) throw new Error(`Could not add a log line (${error.code})`);
  };

  beforeAll(async () => {
    someone = await signInTestCustomer();
    await grantRole(someone.userId, "builder");
    await createBuilderRecord(someone.userId, { active: true });
    staff = await signInTestAdmin();
    const integration = await service
      .from("crm_integrations")
      .insert({ name: `IT Page ${RUN}`, base_url: "https://93.184.216.34", active: true })
      .select("id")
      .single();
    if (integration.error)
      throw new Error(`Could not add a connection (${integration.error.code})`);
    integrationId = integration.data.id;
    const form = await service
      .from("forms")
      .insert({
        name: `IT Page form ${RUN}`,
        slug: `it-page-${RUN}`,
        kind: "contact",
        placement: "contact",
        crm_integration_id: integrationId,
      })
      .select("id")
      .single();
    if (form.error) throw new Error(`Could not add a form (${form.error.code})`);
    formId = form.data.id;
  });

  afterAll(async () => {
    if (submissions.length > 0) {
      await service.from("crm_api_logs").delete().in("submission_id", submissions);
      await service.from("form_submissions").delete().in("id", submissions);
    }
    await service.from("crm_api_logs").delete().eq("integration_id", integrationId);
    await service.from("forms").delete().eq("id", formId);
    await service.from("crm_integrations").delete().eq("id", integrationId);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("offers Retry only on the newest line of a submission that is still failed, and never on a test line", async () => {
    const stuck = await submit();
    const sent = await submit();
    await setState(stuck, "failed");
    await setState(sent, "success");
    // The stuck one failed twice (attempt 2 is the newest); the other failed once and then went through.
    await addLine(stuck, "failed", 1, 0);
    await addLine(sent, "failed", 1, 1);
    await addLine(stuck, "failed", 2, 5);
    await addLine(sent, "success", 2, 6);
    await addLine(null, "failed", 1, 7);

    const page = await readCrmLogs(staff.client);
    const ours = page.logs.filter((entry) => entry.integrationName === `IT Page ${RUN}`);
    const flags = ours.map((entry) => [entry.submissionId, entry.attempt, entry.retryable]);
    expect(flags).toEqual([
      [null, 1, false],
      [sent, 2, false],
      [stuck, 2, true],
      [sent, 1, false],
      [stuck, 1, false],
    ]);
    expect(ours.find((entry) => entry.submissionId === null)?.formName).toBe("Connection test");
    expect(page.failedSubmissions).toBeGreaterThanOrEqual(1);

    // Once the stuck submission goes through, its newest line is no longer offered.
    await setState(stuck, "success");
    const later = await readCrmLogs(staff.client);
    expect(
      later.logs.filter((entry) => entry.retryable && entry.integrationName === `IT Page ${RUN}`),
    ).toEqual([]);
  });

  it("names the connection that took each submission in the Leads list", async () => {
    const mine = await submit();
    const page = await readSubmissionsPage(
      staff.client,
      submissionFilterSchema.parse({ range: "all" }),
      new Date(),
    );
    expect(page.submissions.find((entry) => entry.id === mine)?.agentName).toBe(`IT Page ${RUN}`);
  });

  it("shows no agent once the connection is deleted (the submission keeps its other details)", async () => {
    const lone = await service
      .from("crm_integrations")
      .insert({ name: `IT Page gone ${RUN}`, base_url: "https://93.184.216.34", active: true })
      .select("id")
      .single();
    if (lone.error) throw new Error(`Could not add a connection (${lone.error.code})`);
    const submission = await submit();
    await service
      .from("form_submissions")
      .update({ crm_integration_id: lone.data.id })
      .eq("id", submission);
    await service.from("crm_integrations").delete().eq("id", lone.data.id);
    const page = await readSubmissionsPage(
      staff.client,
      submissionFilterSchema.parse({ range: "all" }),
      new Date(),
    );
    const found = page.submissions.find((entry) => entry.id === submission);
    expect(found?.agentName).toBeNull();
    expect(found?.formName).toBe(`IT Page form ${RUN}`);
  });

  it("shows a builder nothing: the logs are the admin's alone", async () => {
    const result = await readCrmLogs(someone.client).then(
      (page) => page,
      (error: unknown) => error,
    );
    if ("logs" in (result as object)) {
      expect((result as { logs: unknown[] }).logs).toEqual([]);
      expect((result as { failedSubmissions: number }).failedSubmissions).toBe(0);
    } else {
      expect(result).toMatchObject({ code: "42501" });
    }
  });
});
