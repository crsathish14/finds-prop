import { describe, expect, it } from "vitest";
import {
  armRetryJobQuietly,
  deliverOne,
  leadValues,
  retryDelivery,
  runDeliveries,
  syncRetryJob,
  type DeliverySummary,
} from "../delivery";
import {
  CONNECTION,
  DUE,
  NOW,
  PROJECT,
  depsWith,
  fakeFetch,
  fakeStore,
  logCollector,
} from "./delivery-fixtures";

describe("UT-crm-lead-values: what a connection's templates can use (S7-T09 B2)", () => {
  it("has the answers as text, the contact details, the form, the project and the facts of the lead", () => {
    expect(leadValues(DUE, { [PROJECT]: "KV-01" })).toEqual({
      message: "Interested in a 3 BHK",
      budget: "8500000",
      tags: "east, park",
      agree: "true",
      name: "Priya Raman",
      mobile: "9840012345",
      email: "priya@example.test",
      form_name: "Enquiry form",
      project_id: PROJECT,
      project_name: "Kadal Vista",
      project_slug: "kadal-vista",
      project_code: "KV-01",
      source: "/projects/kadal-vista",
      submitted_at: "2026-11-10T09:58:00.000Z",
      submission_id: DUE.submissionId,
    });
  });

  it("lets a filled-in contact column win over an answer of the same name, and a blank one not", () => {
    const filled = leadValues(
      { ...DUE, data: { name: "From the answers", email: "a@b.test" } },
      {},
    );
    expect(filled["name"]).toBe("Priya Raman");
    const blank = leadValues(
      { ...DUE, name: null, email: null, data: { name: "From the answers", email: "a@b.test" } },
      {},
    );
    expect(blank["name"]).toBe("From the answers");
    expect(blank["email"]).toBe("a@b.test");
  });

  it("leaves out an answer that is not text, a number, a flag or a list, and has nothing for a missing project", () => {
    const values = leadValues(
      {
        ...DUE,
        projectId: null,
        projectName: null,
        projectSlug: null,
        source: null,
        data: { nested: { inner: 1 }, nothing: null },
      },
      { [PROJECT]: "KV-01" },
    );
    expect(values["nested"]).toBe("");
    expect(values["nothing"]).toBe("");
    expect(values["project_id"]).toBe("");
    expect(values["project_code"]).toBe("");
    expect(values["project_name"]).toBe("");
    expect(values["source"]).toBe("");
  });

  it("has no project code for a project the connection has no code for", () => {
    expect(
      leadValues(DUE, { "00000000-0000-4000-b000-0000000000ff": "OTHER" })["project_code"],
    ).toBe("");
  });

  it("copes with answers stored as something other than an object", () => {
    expect(leadValues({ ...DUE, data: ["x"] }, {})["form_name"]).toBe("Enquiry form");
    expect(leadValues({ ...DUE, data: null }, {})["form_name"]).toBe("Enquiry form");
  });
});

describe("UT-crm-deliver-one: sending one leased submission (S7-T09 B2, BR-66)", () => {
  it("sends the filled call and records a success with the lead id and no next try", async () => {
    const { store, recorded } = fakeStore();
    const { fetcher, sent } = fakeFetch(200, { data: { lead: { id: "CRM-4821" } } });
    const outcome = await deliverOne(store, DUE, depsWith(fetcher));
    expect(outcome).toEqual({
      submissionId: DUE.submissionId,
      ok: true,
      status: 200,
      retryScheduled: false,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://93.184.216.34/v2/leads");
    expect(sent[0]?.headers.get("x-api-key")).toBe("fake-key-for-tests");
    expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
      fullName: "Priya Raman",
      phone: "9840012345",
      note: "Interested in a 3 BHK",
      project: "KV-01",
      form: "Enquiry form",
    });
    expect(recorded).toEqual([
      {
        submissionId: DUE.submissionId,
        integrationName: "Sample CRM",
        attempt: 1,
        ok: true,
        httpStatus: 200,
        snippet: JSON.stringify({ data: { lead: { id: "CRM-4821" } } }),
        leadId: "CRM-4821",
        nextRetry: null,
      },
    ]);
  });

  it.each([
    [1, 1],
    [2, 5],
    [3, 30],
    [4, 120],
    [5, 720],
  ])("after failed attempt %i schedules the next try in %i minutes", async (attempt, minutes) => {
    const { store, recorded } = fakeStore();
    const { fetcher } = fakeFetch(502, "Bad gateway");
    const outcome = await deliverOne(store, { ...DUE, attempt }, depsWith(fetcher));
    expect(outcome).toMatchObject({ ok: false, status: 502, retryScheduled: true });
    expect(recorded[0]).toMatchObject({
      ok: false,
      httpStatus: 502,
      snippet: "Bad gateway",
      leadId: null,
      attempt,
    });
    expect(recorded[0]?.nextRetry?.getTime()).toBe(NOW + minutes * 60_000);
  });

  it("schedules nothing after the sixth failed attempt", async () => {
    const { store, recorded } = fakeStore();
    const { fetcher } = fakeFetch(500, "down");
    const outcome = await deliverOne(store, { ...DUE, attempt: 6 }, depsWith(fetcher));
    expect(outcome.retryScheduled).toBe(false);
    expect(recorded[0]?.nextRetry).toBeNull();
  });

  it("records a connection that is gone as a failed attempt, and sends nothing", async () => {
    const { store, recorded } = fakeStore({ connection: null });
    const { fetcher } = fakeFetch();
    const outcome = await deliverOne(store, DUE, depsWith(fetcher));
    expect(fetcher).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, status: null, retryScheduled: true });
    expect(recorded[0]).toMatchObject({
      integrationName: "CRM",
      snippet: "The connection was deleted.",
      httpStatus: null,
    });
  });

  it("records an unexpected error as a failed attempt with a plain sentence, and logs it", async () => {
    const { store, recorded } = fakeStore({ connection: "throws" });
    const { log, lines } = logCollector();
    const outcome = await deliverOne(store, DUE, depsWith(fakeFetch().fetcher, log));
    expect(outcome).toMatchObject({ ok: false, status: null, retryScheduled: true });
    expect(recorded[0]?.snippet).toBe("The delivery could not be sent.");
    expect(lines.some((line) => line.level === "error")).toBe(true);
  });

  it("records an address that is no longer public as a failed attempt without calling it", async () => {
    const { store, recorded } = fakeStore({
      connection: {
        name: "Sample CRM",
        connection: { ...CONNECTION, baseUrl: "https://10.0.0.5" },
        secrets: { apiKey: null, apiSecret: null, accessToken: null },
        projectCodes: {},
      },
    });
    const { fetcher } = fakeFetch();
    await deliverOne(store, DUE, depsWith(fetcher));
    expect(fetcher).not.toHaveBeenCalled();
    expect(recorded[0]).toMatchObject({ ok: false, httpStatus: null });
    expect(recorded[0]?.snippet).toBe("This address is not allowed: it must be https and public.");
  });

  it("never puts a secret in what it records", async () => {
    const { store, recorded } = fakeStore();
    const { fetcher } = fakeFetch(401, "bad key fake-key-for-tests");
    await deliverOne(store, DUE, depsWith(fetcher));
    expect(recorded[0]?.snippet).toBe("bad key ***");
  });

  it("throws when the result cannot be recorded, so the caller can count it as lost", async () => {
    const { store } = fakeStore({ recordFails: [DUE.submissionId] });
    await expect(deliverOne(store, DUE, depsWith(fakeFetch().fetcher))).rejects.toThrow(
      "record failed",
    );
  });
});

describe("UT-crm-run: claiming and sending what is due (S7-T09 B2)", () => {
  const second = { ...DUE, submissionId: "00000000-0000-4000-a000-000000000002" };
  const third = { ...DUE, submissionId: "00000000-0000-4000-a000-000000000003" };

  it("claims with the limit and the named submission, and counts what was sent and what failed", async () => {
    const { store, calls, recorded } = fakeStore({ due: [DUE, second] });
    let answered = 0;
    const fetcher = (async () =>
      new Response("x", { status: (answered += 1) === 1 ? 200 : 500 })) as unknown as typeof fetch;
    const summary = await runDeliveries(
      store,
      { limit: 10, submissionId: "named" },
      depsWith(fetcher),
    );
    expect(calls[0]).toBe("claim:10:named");
    expect(summary).toMatchObject({
      claimed: 2,
      sent: 1,
      failed: 1,
      lost: 0,
      retryScheduled: true,
    });
    expect(recorded).toHaveLength(2);
  });

  it("does nothing, and says so, when nothing is due", async () => {
    const { store, calls } = fakeStore({ due: [] });
    const summary = await runDeliveries(store, { limit: 10 }, depsWith(fakeFetch().fetcher));
    expect(summary).toEqual({
      claimed: 0,
      sent: 0,
      failed: 0,
      lost: 0,
      retryScheduled: false,
      outcomes: [],
    });
    expect(calls).toEqual(["claim:10:any"]);
  });

  it("sends at most three at the same time", async () => {
    let running = 0;
    let most = 0;
    const many = Array.from({ length: 7 }, (_row, index) => ({
      ...DUE,
      submissionId: `00000000-0000-4000-a000-0000000001${String(index).padStart(2, "0")}`,
    }));
    const { store, recorded } = fakeStore({
      due: many,
      onSend: async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
    });
    const summary = await runDeliveries(store, { limit: 10 }, depsWith(fakeFetch().fetcher));
    expect(summary.sent).toBe(7);
    expect(recorded).toHaveLength(7);
    expect(most).toBeLessThanOrEqual(3);
    expect(most).toBeGreaterThan(1);
  });

  it("counts a result that could not be recorded as lost, logs it, and still sends the rest", async () => {
    const { store, recorded } = fakeStore({
      due: [DUE, second, third],
      recordFails: [second.submissionId],
    });
    const { log, lines } = logCollector();
    const summary = await runDeliveries(store, { limit: 10 }, depsWith(fakeFetch().fetcher, log));
    expect(summary).toMatchObject({ claimed: 3, sent: 2, failed: 0, lost: 1 });
    expect(recorded.map((entry) => entry.submissionId)).toEqual([
      DUE.submissionId,
      third.submissionId,
    ]);
    expect(lines.filter((line) => line.level === "error")).toHaveLength(1);
  });

  it("lets a claim failure through to the caller", async () => {
    const { store } = fakeStore({ claimFails: true });
    await expect(
      runDeliveries(store, { limit: 10 }, depsWith(fakeFetch().fetcher)),
    ).rejects.toThrow("claim failed");
  });
});

describe("UT-crm-job: arming and disarming the retry job (S7-T09 B2, BR-66)", () => {
  const summary = (change: Partial<DeliverySummary> = {}): DeliverySummary => ({
    claimed: 1,
    sent: 1,
    failed: 0,
    lost: 0,
    retryScheduled: false,
    outcomes: [],
    ...change,
  });

  it("arms the job after a send that left a retry waiting", async () => {
    const { store, calls } = fakeStore();
    await syncRetryJob(
      store,
      summary({ failed: 1, sent: 0, retryScheduled: true }),
      logCollector().log,
      "other",
    );
    expect(calls).toEqual(["arm"]);
  });

  it("arms the job after a result was lost", async () => {
    const { store, calls } = fakeStore();
    await syncRetryJob(store, summary({ lost: 1 }), logCollector().log, "other");
    expect(calls).toEqual(["arm"]);
  });

  it("leaves the job alone after a clean success, or when nothing was claimed", async () => {
    const { store, calls } = fakeStore();
    await syncRetryJob(store, summary(), logCollector().log, "other");
    await syncRetryJob(store, summary({ claimed: 0, sent: 0 }), logCollector().log, "other");
    expect(calls).toEqual([]);
  });

  it("in the job's own run, disarms the job once nothing waits, and keeps it while something does", async () => {
    const drained = fakeStore({ waiting: false });
    await syncRetryJob(drained.store, summary(), logCollector().log, "job");
    expect(drained.calls).toEqual(["hasWaiting", "disarm"]);
    const busy = fakeStore({ waiting: true });
    await syncRetryJob(busy.store, summary({ retryScheduled: true }), logCollector().log, "job");
    expect(busy.calls).toEqual(["hasWaiting"]);
  });

  it("does not re-arm the job from inside its own run", async () => {
    const { store, calls } = fakeStore({ waiting: true });
    await syncRetryJob(
      store,
      summary({ failed: 1, retryScheduled: true }),
      logCollector().log,
      "job",
    );
    expect(calls).not.toContain("arm");
  });

  it("logs, and does not throw, when the job cannot be changed (the address or token is not set yet)", async () => {
    const { store } = fakeStore({ armFails: true, disarmFails: true, waiting: false });
    const { log, lines } = logCollector();
    await expect(
      syncRetryJob(store, summary({ retryScheduled: true }), log, "other"),
    ).resolves.toBeUndefined();
    await expect(syncRetryJob(store, summary(), log, "job")).resolves.toBeUndefined();
    expect(lines.filter((line) => line.level === "warn")).toHaveLength(2);
  });
});

describe("UT-crm-arm-quietly: arming the job when a connection is switched on (S7-T09 B2)", () => {
  it("arms the job", async () => {
    const { store, calls } = fakeStore();
    await armRetryJobQuietly(store, logCollector().log);
    expect(calls).toEqual(["arm"]);
  });

  it("logs, and does not throw, when the job cannot be armed", async () => {
    const { store } = fakeStore({ armFails: true });
    const { log, lines } = logCollector();
    await expect(armRetryJobQuietly(store, log)).resolves.toBeUndefined();
    expect(lines.filter((line) => line.level === "warn")).toHaveLength(1);
  });
});

describe("UT-crm-retry-now: Retry delivery now (S7-T09 B2)", () => {
  it("sends the one submission named, with a limit of one, and answers how it went", async () => {
    const { store, calls } = fakeStore({ due: [DUE] });
    const result = await retryDelivery(
      store,
      { submissionId: DUE.submissionId },
      depsWith(fakeFetch(200).fetcher),
    );
    expect(calls[0]).toBe(`claim:1:${DUE.submissionId}`);
    expect(result.outcome).toMatchObject({ ok: true, status: 200 });
    expect(result.summary.claimed).toBe(1);
  });

  it("answers a conflict when nothing could be claimed: sent already, being sent, inactive, or gone", async () => {
    const { store } = fakeStore({ due: [] });
    await expect(
      retryDelivery(store, { submissionId: DUE.submissionId }, depsWith(fakeFetch().fetcher)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("answers an internal error, not a conflict, when the attempt was made but could not be recorded", async () => {
    const { store } = fakeStore({ due: [DUE], recordFails: [DUE.submissionId] });
    await expect(
      retryDelivery(store, { submissionId: DUE.submissionId }, depsWith(fakeFetch().fetcher)),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
