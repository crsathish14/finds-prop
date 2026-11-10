import { describe, expect, it } from "vitest";
import { toCrmLogViews } from "../logs-view";

const SUBMISSION_A = "00000000-0000-4000-a000-00000000000a";
const SUBMISSION_B = "00000000-0000-4000-a000-00000000000b";

const line = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  created_at: "2026-10-28T11:02:00+00:00",
  integration_name: "Sample CRM",
  form_name: "Enquiry form",
  outcome: "failed",
  http_status: 502,
  attempt: 2,
  response_snippet: "Bad gateway",
  submission_id: SUBMISSION_A,
  ...extra,
});

describe("UT-crm-logs-view: the delivery log as the API logs tab shows it (S7-T09)", () => {
  it("maps a line to its view", () => {
    const { logs, skipped } = toCrmLogViews([line("1")], new Set([SUBMISSION_A]));
    expect(skipped).toBe(0);
    expect(logs[0]).toEqual({
      id: "1",
      createdAt: "2026-10-28T11:02:00+00:00",
      integrationName: "Sample CRM",
      formName: "Enquiry form",
      outcome: "failed",
      httpStatus: 502,
      attempt: 2,
      snippet: "Bad gateway",
      submissionId: SUBMISSION_A,
      retryable: true,
    });
  });

  it("offers Retry only on the newest line of a submission that is still failed", () => {
    // Newest first: attempt 2 is the latest line of submission A, attempt 1 is older.
    const { logs } = toCrmLogViews(
      [line("new", { attempt: 2 }), line("old", { attempt: 1 })],
      new Set([SUBMISSION_A]),
    );
    expect(logs.map((entry) => [entry.id, entry.retryable])).toEqual([
      ["new", true],
      ["old", false],
    ]);
  });

  it("offers no Retry on a submission that is not failed any more (sent since, or waiting)", () => {
    const { logs } = toCrmLogViews([line("1")], new Set());
    expect(logs[0]?.retryable).toBe(false);
  });

  it("offers no Retry on a line that worked, even for a submission that is failed", () => {
    const { logs } = toCrmLogViews(
      [line("1", { outcome: "success", http_status: 200 })],
      new Set([SUBMISSION_A]),
    );
    expect(logs[0]?.retryable).toBe(false);
  });

  it("offers no Retry on a test call, which has no submission", () => {
    const { logs } = toCrmLogViews(
      [line("t", { submission_id: null, form_name: "Connection test", outcome: "failed" })],
      new Set([SUBMISSION_A]),
    );
    expect(logs[0]).toMatchObject({
      submissionId: null,
      formName: "Connection test",
      retryable: false,
    });
  });

  it("works out the newest line for each submission on its own", () => {
    const { logs } = toCrmLogViews(
      [
        line("b1", { submission_id: SUBMISSION_B }),
        line("a1", { submission_id: SUBMISSION_A }),
        line("a0", { submission_id: SUBMISSION_A, attempt: 1 }),
      ],
      new Set([SUBMISSION_A, SUBMISSION_B]),
    );
    expect(logs.map((entry) => [entry.id, entry.retryable])).toEqual([
      ["b1", true],
      ["a1", true],
      ["a0", false],
    ]);
  });

  it("keeps a missing answer, form and status as nothing, not as text", () => {
    const { logs } = toCrmLogViews(
      [line("1", { form_name: null, http_status: null, response_snippet: null })],
      new Set(),
    );
    expect(logs[0]).toMatchObject({ formName: null, httpStatus: null, snippet: null });
  });

  it("leaves out, and counts, a line that is not in the expected shape", () => {
    const { logs, skipped } = toCrmLogViews(
      [
        line("1", { outcome: "pending" }),
        line("2", { attempt: "x" }),
        { nonsense: true },
        line("3"),
      ],
      new Set(),
    );
    expect(logs.map((entry) => entry.id)).toEqual(["3"]);
    expect(skipped).toBe(3);
  });

  it("reads nothing as no lines", () => {
    expect(toCrmLogViews(null, new Set())).toEqual({ logs: [], skipped: 0 });
  });
});
