import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: vi.fn() }));

const { deliveryStore } = await import("../service");

type Failure = { code?: string; message?: string } | null;

const ROW = {
  submission_id: "00000000-0000-4000-a000-000000000001",
  integration_id: "00000000-0000-4000-a000-0000000000a1",
  attempt: 3,
  form_name: "Enquiry form",
  project_id: "00000000-0000-4000-b000-0000000000a1",
  project_name: "Kadal Vista",
  project_slug: "kadal-vista",
  name: "Priya Raman",
  mobile: "9840012345",
  email: null,
  data: { message: "hello" },
  source: "/projects/kadal-vista",
  created_at: "2026-11-10T09:58:00+00:00",
};

const rpcClient = (answer: { data?: unknown; error: Failure }) => {
  const rpc = vi.fn(async () => answer);
  return { store: deliveryStore({ rpc } as unknown as SupabaseClient<Database>), rpc };
};

describe("UT-crm-delivery-store: the delivery engine's calls with the service role (S7-T09 B2)", () => {
  it("claims with the limit, and with the submission only when one is named", async () => {
    const { store, rpc } = rpcClient({ data: [ROW], error: null });
    await store.claim(10);
    await store.claim(1, ROW.submission_id);
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_crm_deliveries", { p_limit: 10 });
    expect(rpc).toHaveBeenNthCalledWith(2, "claim_crm_deliveries", {
      p_limit: 1,
      p_submission: ROW.submission_id,
    });
  });

  it("turns a claimed row into the engine's submission", async () => {
    const { store } = rpcClient({ data: [ROW], error: null });
    expect(await store.claim(10)).toEqual([
      {
        submissionId: ROW.submission_id,
        integrationId: ROW.integration_id,
        attempt: 3,
        formName: "Enquiry form",
        projectId: ROW.project_id,
        projectName: "Kadal Vista",
        projectSlug: "kadal-vista",
        name: "Priya Raman",
        mobile: "9840012345",
        email: null,
        data: { message: "hello" },
        source: "/projects/kadal-vista",
        createdAt: "2026-11-10T09:58:00+00:00",
      },
    ]);
  });

  it("turns a failed claim into an action error", async () => {
    const { store } = rpcClient({ data: null, error: { code: "XX000" } });
    await expect(store.claim(10)).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("records a result with the values that exist, and leaves out the ones that do not", async () => {
    const { store, rpc } = rpcClient({ error: null });
    await store.record({
      submissionId: ROW.submission_id,
      integrationName: "Sample CRM",
      attempt: 2,
      ok: false,
      httpStatus: 502,
      snippet: "Bad gateway",
      leadId: null,
      nextRetry: new Date("2026-11-10T10:05:00.000Z"),
    });
    await store.record({
      submissionId: ROW.submission_id,
      integrationName: "Sample CRM",
      attempt: 1,
      ok: true,
      httpStatus: null,
      snippet: "ok",
      leadId: "CRM-1",
      nextRetry: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "record_crm_delivery", {
      p_submission: ROW.submission_id,
      p_integration_name: "Sample CRM",
      p_attempt: 2,
      p_ok: false,
      p_snippet: "Bad gateway",
      p_http_status: 502,
      p_next_retry: "2026-11-10T10:05:00.000Z",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_crm_delivery", {
      p_submission: ROW.submission_id,
      p_integration_name: "Sample CRM",
      p_attempt: 1,
      p_ok: true,
      p_snippet: "ok",
      p_lead_id: "CRM-1",
    });
  });

  it("throws when a result cannot be recorded", async () => {
    const { store } = rpcClient({ error: { code: "22023", message: "crm.bad_attempt" } });
    await expect(
      store.record({
        submissionId: ROW.submission_id,
        integrationName: "x",
        attempt: 1,
        ok: true,
        httpStatus: null,
        snippet: "",
        leadId: null,
        nextRetry: null,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("arms and disarms the job through the database's two functions", async () => {
    const { store, rpc } = rpcClient({ error: null });
    await store.armRetryJob();
    await store.disarmRetryJob();
    expect(rpc).toHaveBeenNthCalledWith(1, "arm_crm_retry");
    expect(rpc).toHaveBeenNthCalledWith(2, "disarm_crm_retry");
  });

  it("throws when the job cannot be armed (the site address or the token is not set)", async () => {
    const { store } = rpcClient({ error: { message: "crm_retry.not_configured" } });
    await expect(store.armRetryJob()).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(store.disarmRetryJob()).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("reads the retry job's token by its name", async () => {
    const eq = vi.fn(() => ({
      maybeSingle: async () => ({ data: { token: "fake-token-for-tests" }, error: null }),
    }));
    const from = vi.fn(() => ({ select: () => ({ eq }) }));
    const store = deliveryStore({ from } as unknown as SupabaseClient<Database>);
    expect(await store.readToken()).toBe("fake-token-for-tests");
    expect(from).toHaveBeenCalledWith("internal_cron_tokens");
    expect(eq).toHaveBeenCalledWith("name", "crm_retry");
  });

  it("has no token when none is set", async () => {
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }));
    const store = deliveryStore({ from } as unknown as SupabaseClient<Database>);
    expect(await store.readToken()).toBeNull();
  });
});

describe("UT-crm-has-waiting: whether the retry job still has work (S7-T09 B2)", () => {
  function waitingClient(options: {
    active: { id: string }[];
    count?: number | null;
    activeError?: Failure;
    countError?: Failure;
  }) {
    const or = vi.fn(async () => ({
      count: options.count ?? 0,
      error: options.countError ?? null,
    }));
    const inFilter = vi.fn(() => ({ or }));
    const from = vi.fn((table: string) =>
      table === "crm_integrations"
        ? {
            select: () => ({
              eq: async () => ({
                data: options.activeError ? null : options.active,
                error: options.activeError ?? null,
              }),
            }),
          }
        : { select: () => ({ in: inFilter }) },
    );
    return {
      store: deliveryStore({ from } as unknown as SupabaseClient<Database>),
      from,
      inFilter,
      or,
    };
  }

  it("is false without reading submissions when no connection is active", async () => {
    const { store, from } = waitingClient({ active: [] });
    expect(await store.hasWaiting()).toBe(false);
    expect(from).not.toHaveBeenCalledWith("form_submissions");
  });

  it("counts pending submissions and failed ones with a retry time, on the active connections only", async () => {
    const { store, inFilter, or } = waitingClient({
      active: [{ id: "a1" }, { id: "a2" }],
      count: 2,
    });
    expect(await store.hasWaiting()).toBe(true);
    expect(inFilter).toHaveBeenCalledWith("crm_integration_id", ["a1", "a2"]);
    expect(or).toHaveBeenCalledWith(
      "crm_status.eq.pending,and(crm_status.eq.failed,next_retry_at.not.is.null)",
    );
  });

  it("is false when none wait", async () => {
    expect(await waitingClient({ active: [{ id: "a1" }], count: 0 }).store.hasWaiting()).toBe(
      false,
    );
  });

  it("throws when either read fails", async () => {
    await expect(
      waitingClient({ active: [], activeError: { code: "XX000" } }).store.hasWaiting(),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
    await expect(
      waitingClient({ active: [{ id: "a1" }], countError: { code: "XX000" } }).store.hasWaiting(),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
