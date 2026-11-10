import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("server-only", () => ({}));

const { deliveryStore } = await import("@/features/crm/service");
const { retryDelivery, runDeliveries } = await import("@/features/crm/delivery");
const { handleCrmRetry } = await import("@/features/crm/retry-handler");
const { createLogger } = await import("@/server/logger");

// IT-crm-delivery (S7-T09 part B2, ADR-114, ADR-116): the delivery engine against a real database. The claim and the
// record are database functions, the engine sends through a stand-in for `fetch` (an address written out as an IP
// number, so no name lookup and no network), and the retry route answers only to its token. The sweep is not run
// here as it would take other tests' submissions; pgTAP covers what it takes. The route test claims only its own.

const RUN = randomUUID().slice(0, 8);
const TOKEN = `fake-token-for-tests-${RUN}-padding-padding`;
const log = createLogger({}, { write: () => undefined });

const answering = (status: number, body: string) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("IT-crm-delivery: sending form submissions to a CRM against a real database (S7-T09 B2)", () => {
  const service = adminClient();
  const store = deliveryStore(service);
  let integrationId: string;
  let inactiveId: string;
  let formId: string;
  let inactiveFormId: string;
  const submissions: string[] = [];
  let tokenWasSet = false;

  const submit = async (slug: string, change: { name?: string } = {}) => {
    const { data, error } = await service.rpc("record_form_submission", {
      p_form_slug: slug,
      p_visitor_hash: "a".repeat(40),
      p_name: change.name ?? "Priya Raman",
      p_mobile: "9840012345",
      p_data: { message: `hello ${RUN}` },
      p_idempotency_key: randomUUID(),
    });
    if (error || typeof data !== "string")
      throw new Error(`Could not store a submission (${error?.code})`);
    submissions.push(data);
    return data;
  };

  const row = async (id: string) => {
    const { data, error } = await service
      .from("form_submissions")
      .select(
        "crm_status, crm_attempts, crm_http_status, crm_lead_id, next_retry_at, last_error, crm_claimed_until, crm_integration_id",
      )
      .eq("id", id)
      .single();
    if (error) throw new Error(`Could not read the submission (${error.code})`);
    return data;
  };

  const logs = async (id: string) => {
    const { data, error } = await service
      .from("crm_api_logs")
      .select("integration_name, form_name, outcome, http_status, attempt, response_snippet")
      .eq("submission_id", id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Could not read the log (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    // One insert each: a bulk insert gives a column a row leaves out NULL, not its default.
    const active = await service
      .from("crm_integrations")
      .insert({
        name: `IT Delivery ${RUN}`,
        base_url: "https://93.184.216.34",
        endpoint: "/leads",
        method: "POST",
        lead_id_path: "lead.id",
        active: true,
        headers: { "X-Api-Key": "{{api_key}}" },
        body_mapping: { fullName: "{{name}}", note: "{{message}}" },
      })
      .select("id")
      .single();
    if (active.error) throw new Error(`Could not add a connection (${active.error.code})`);
    integrationId = active.data.id;
    const inactive = await service
      .from("crm_integrations")
      .insert({ name: `IT Delivery off ${RUN}`, base_url: "https://93.184.216.34", active: false })
      .select("id")
      .single();
    if (inactive.error) throw new Error(`Could not add a connection (${inactive.error.code})`);
    inactiveId = inactive.data.id;
    await service
      .from("crm_integration_secrets")
      .insert({ integration_id: integrationId, api_key: `fake-key-for-tests-${RUN}` });

    const forms = await service
      .from("forms")
      .insert([
        {
          name: `IT Delivery form ${RUN}`,
          slug: `it-delivery-${RUN}`,
          kind: "contact",
          placement: "contact",
          crm_integration_id: integrationId,
        },
        {
          name: `IT Delivery off form ${RUN}`,
          slug: `it-delivery-off-${RUN}`,
          kind: "contact",
          placement: "contact",
          crm_integration_id: inactiveId,
        },
      ])
      .select("id, slug");
    if (forms.error) throw new Error(`Could not add forms (${forms.error.code})`);
    formId = forms.data.find((entry) => entry.slug === `it-delivery-${RUN}`)?.id ?? "";
    inactiveFormId = forms.data.find((entry) => entry.slug === `it-delivery-off-${RUN}`)?.id ?? "";

    const existing = await service
      .from("internal_cron_tokens")
      .select("name")
      .eq("name", "crm_retry")
      .maybeSingle();
    tokenWasSet = existing.data !== null;
    if (!tokenWasSet) {
      const added = await service
        .from("internal_cron_tokens")
        .insert({ name: "crm_retry", token: TOKEN });
      if (added.error) throw new Error(`Could not set the token (${added.error.code})`);
    }
  });

  afterAll(async () => {
    if (submissions.length > 0) {
      await service.from("crm_api_logs").delete().in("submission_id", submissions);
      await service.from("form_submissions").delete().in("id", submissions);
    }
    await service.from("forms").delete().in("id", [formId, inactiveFormId]);
    await service.from("crm_api_logs").delete().in("integration_id", [integrationId, inactiveId]);
    await service.from("crm_integrations").delete().in("id", [integrationId, inactiveId]);
    if (!tokenWasSet) await service.from("internal_cron_tokens").delete().eq("name", "crm_retry");
  });

  it("starts a submission to a form with a connection as pending, with no attempts yet", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    expect(await row(id)).toMatchObject({
      crm_status: "pending",
      crm_attempts: 0,
      crm_integration_id: integrationId,
    });
  });

  it("sends a stored submission by name: the filled call goes out, the result and one log line are recorded", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    const sent: { url: string; headers: Headers; body: string }[] = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), headers: init?.headers as Headers, body: String(init?.body) });
      return new Response(JSON.stringify({ lead: { id: `CRM-${RUN}` } }), { status: 200 });
    }) as unknown as typeof fetch;

    const summary = await runDeliveries(
      store,
      { limit: 1, submissionId: id },
      { fetch: fetcher, log },
    );
    expect(summary).toMatchObject({ claimed: 1, sent: 1, failed: 0, lost: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://93.184.216.34/leads");
    expect(sent[0]?.headers.get("x-api-key")).toBe(`fake-key-for-tests-${RUN}`);
    expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
      fullName: "Priya Raman",
      note: `hello ${RUN}`,
    });

    expect(await row(id)).toMatchObject({
      crm_status: "success",
      crm_attempts: 1,
      crm_http_status: 200,
      crm_lead_id: `CRM-${RUN}`,
      next_retry_at: null,
      last_error: null,
      crm_claimed_until: null,
    });
    expect(await logs(id)).toEqual([
      {
        integration_name: `IT Delivery ${RUN}`,
        form_name: `IT Delivery form ${RUN}`,
        outcome: "success",
        http_status: 200,
        attempt: 1,
        response_snippet: JSON.stringify({ lead: { id: `CRM-${RUN}` } }),
      },
    ]);
  });

  it("does not send the same submission twice: it is sent, or still leased", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    await runDeliveries(
      store,
      { limit: 1, submissionId: id },
      { fetch: answering(200, "{}"), log },
    );
    const again = await runDeliveries(
      store,
      { limit: 1, submissionId: id },
      { fetch: answering(200, "{}"), log },
    );
    expect(again.claimed).toBe(0);
  });

  it("records a failure with its reason and the next try in a minute, and never a secret in the log", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    const before = Date.now();
    const summary = await runDeliveries(
      store,
      { limit: 1, submissionId: id },
      { fetch: answering(401, `invalid key fake-key-for-tests-${RUN}`), log },
    );
    expect(summary).toMatchObject({ claimed: 1, sent: 0, failed: 1, retryScheduled: true });
    const stored = await row(id);
    expect(stored).toMatchObject({
      crm_status: "failed",
      crm_attempts: 1,
      crm_http_status: 401,
      last_error: "invalid key ***",
      crm_claimed_until: null,
    });
    const retryAt = Date.parse(stored.next_retry_at ?? "");
    expect(retryAt).toBeGreaterThan(before + 50_000);
    expect(retryAt).toBeLessThan(Date.now() + 70_000);
    const lines = await logs(id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      outcome: "failed",
      http_status: 401,
      attempt: 1,
      response_snippet: "invalid key ***",
    });
  });

  it("records an address that is not public as a failed attempt, without calling it", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    await service
      .from("crm_integrations")
      .update({ base_url: "https://10.0.0.5" })
      .eq("id", integrationId);
    const fetcher = vi.fn() as unknown as typeof fetch;
    try {
      const summary = await runDeliveries(
        store,
        { limit: 1, submissionId: id },
        { fetch: fetcher, log },
      );
      expect(summary).toMatchObject({ claimed: 1, failed: 1 });
      expect(fetcher).not.toHaveBeenCalled();
      expect(await row(id)).toMatchObject({
        crm_status: "failed",
        last_error: "This address is not allowed: it must be https and public.",
      });
    } finally {
      await service
        .from("crm_integrations")
        .update({ base_url: "https://93.184.216.34" })
        .eq("id", integrationId);
    }
  });

  it("sends a submission that failed for good again by name, as attempt 1 on a fresh schedule", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    await service
      .from("form_submissions")
      .update({ crm_status: "failed", crm_attempts: 6, next_retry_at: null, last_error: "old" })
      .eq("id", id);
    const { outcome } = await retryDelivery(
      store,
      { submissionId: id },
      { fetch: answering(200, "{}"), log },
    );
    expect(outcome).toMatchObject({ ok: true, status: 200 });
    expect(await row(id)).toMatchObject({
      crm_status: "success",
      crm_attempts: 1,
      last_error: null,
      next_retry_at: null,
    });
  });

  it("answers a conflict for a submission that is already sent", async () => {
    const id = await submit(`it-delivery-${RUN}`);
    await runDeliveries(
      store,
      { limit: 1, submissionId: id },
      { fetch: answering(200, "{}"), log },
    );
    await expect(
      retryDelivery(store, { submissionId: id }, { fetch: answering(200, "{}"), log }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("leaves a submission on an inactive connection waiting: not sent, not lost", async () => {
    const id = await submit(`it-delivery-off-${RUN}`);
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(
      retryDelivery(store, { submissionId: id }, { fetch: fetcher, log }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await row(id)).toMatchObject({ crm_status: "pending", crm_attempts: 0 });
  });

  it("knows that a submission is waiting on an active connection", async () => {
    await submit(`it-delivery-${RUN}`);
    expect(await store.hasWaiting()).toBe(true);
  });

  it("reads the retry job's token", async () => {
    expect(await store.readToken()).not.toBeNull();
  });

  describe("the retry route", () => {
    // Claims only this test's own submissions, so another test's rows are never sent with the stand-in fetch.
    const ownStore = (ids: string[]) => ({
      ...store,
      claim: async () => {
        const claimed = await Promise.all(ids.map((id) => store.claim(1, id)));
        return claimed.flat();
      },
      hasWaiting: async () => true,
    });
    const post = (token: string | null) =>
      new Request("https://findprop.example/api/internal/crm-retry", {
        method: "POST",
        headers: token === null ? {} : { "x-cron-token": token },
      });

    it("refuses a wrong token and a missing one with a plain 401", async () => {
      const id = await submit(`it-delivery-${RUN}`);
      for (const token of [null, "wrong-token-for-tests"]) {
        const response = await handleCrmRetry(post(token), {
          store: ownStore([id]),
          fetch: answering(200, "{}"),
        });
        expect(response.status).toBe(401);
      }
      expect(await row(id)).toMatchObject({ crm_status: "pending", crm_claimed_until: null });
    });

    it("sends what is due when it has the token, and answers only the counts", async () => {
      const id = await submit(`it-delivery-${RUN}`);
      const stored = (await store.readToken()) ?? "";
      const response = await handleCrmRetry(post(stored), {
        store: ownStore([id]),
        fetch: answering(200, JSON.stringify({ lead: { id: "CRM-ROUTE" } })),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ claimed: 1, sent: 1, failed: 0 });
      expect(await row(id)).toMatchObject({ crm_status: "success", crm_lead_id: "CRM-ROUTE" });
    });
  });
});
