// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { CrmLogView } from "../logs-view";
import type { CrmIntegrationView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { AdminCrm } = await import("../crm-page.client");

const words = en.admin.crm;

const SAMPLE_ID = "00000000-0000-4000-a000-000000000001";
const BACKUP_ID = "00000000-0000-4000-a000-000000000002";

const connection = (extra: Partial<CrmIntegrationView> = {}): CrmIntegrationView => ({
  id: SAMPLE_ID,
  name: "Sample CRM",
  leadSource: "Find Prop website",
  baseUrl: "https://api.crm.example/",
  endpoint: "/v2/leads",
  method: "POST",
  leadIdPath: "data.lead.id",
  active: true,
  headers: [],
  bodyMapping: [],
  projectCodes: [],
  hasApiKey: true,
  hasApiSecret: false,
  hasAccessToken: true,
  forms: 2,
  ...extra,
});

const SAMPLE = connection();
const BACKUP = connection({
  id: BACKUP_ID,
  name: "Backup CRM",
  baseUrl: "https://hooks.backup.example",
  endpoint: null,
  active: false,
  hasApiKey: false,
  hasAccessToken: false,
});

const SUBMISSION = "00000000-0000-4000-b000-000000000001";

const log = (id: string, extra: Partial<CrmLogView> = {}): CrmLogView => ({
  id,
  createdAt: "2026-10-28T05:32:00+00:00",
  integrationName: "Sample CRM",
  formName: "Contact",
  outcome: "failed",
  httpStatus: 502,
  attempt: 2,
  snippet: "Bad gateway: upstream timed out",
  submissionId: SUBMISSION,
  retryable: true,
  ...extra,
});

type Props = Parameters<typeof AdminCrm>[0];

function open(props: Partial<Props> = {}) {
  const actions = {
    test: vi.fn(async () => ({
      ok: true as const,
      data: { integrationName: "Sample CRM", ok: true, status: 200, durationMs: 412 },
    })),
    remove: vi.fn(async () => ({ ok: true as const, data: {} })),
    retry: vi.fn(async () => ({
      ok: true as const,
      data: { submissionId: SUBMISSION, ok: true, status: 200 },
    })),
    ...props.actions,
  };
  const view = renderWithMessages(
    <AdminCrm
      tab="connections"
      connections={[SAMPLE, BACKUP]}
      logs={{ logs: [log("1")], failedSubmissions: 1 }}
      {...props}
      actions={actions}
    />,
  );
  return { actions, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the admin's CRM page, connections tab (S7-T09)", () => {
  it("has the heading, New connection, and the two tabs with their numbers", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByRole("link", { name: words.new })).toHaveAttribute("href", "/admin/crm/new");
    expect(screen.getByRole("tab", { name: /Connections/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Connections/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /API logs/ })).toHaveTextContent("1 failed");
  });

  it("shows no failed number on the logs tab when nothing is failed", () => {
    open({ logs: { logs: [], failedSubmissions: 0 } });
    expect(screen.getByRole("tab", { name: /API logs/ })).not.toHaveTextContent("failed");
  });

  it("draws each connection with its state, its address and whether each secret is set, never a value", () => {
    open();
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    expect(within(sample).getByText(words.cards.active)).toBeVisible();
    expect(within(sample).getByText("POST https://api.crm.example/v2/leads")).toBeVisible();
    expect(within(sample).getAllByText(words.cards.secretSet)).toHaveLength(2);
    expect(within(sample).getAllByText(words.cards.secretNotSet)).toHaveLength(1);
    expect(within(sample).getByText(words.cards.secretsNote)).toBeVisible();
    const backup = screen.getByRole("article", { name: "Backup CRM" });
    expect(within(backup).getByText(words.cards.inactive)).toBeVisible();
    expect(within(backup).getByText("POST https://hooks.backup.example")).toBeVisible();
    expect(within(backup).getAllByText(words.cards.secretNotSet)).toHaveLength(3);
  });

  it("links Edit to the connection's page", () => {
    open();
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    expect(within(sample).getByRole("link", { name: /Edit/ })).toHaveAttribute(
      "href",
      `/admin/crm/${SAMPLE_ID}`,
    );
  });

  it("says there are no connections, with New connection", () => {
    open({ connections: [] });
    expect(screen.getByText(words.cards.empty.title)).toBeVisible();
    expect(screen.getAllByRole("link", { name: words.new }).length).toBeGreaterThan(0);
  });

  it("turns Test API off for an inactive connection", () => {
    open();
    const backup = screen.getByRole("article", { name: "Backup CRM" });
    expect(within(backup).getByRole("button", { name: /Test API/ })).toBeDisabled();
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    expect(within(sample).getByRole("button", { name: /Test API/ })).toBeEnabled();
  });

  it("tests a connection and says how it went, with the time", async () => {
    const { actions } = open();
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: /Test API/ }));
    expect(actions.test).toHaveBeenCalledWith({ integrationId: SAMPLE_ID });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(words.test.succeededTitle);
    expect(notice).toHaveTextContent(
      "Sample CRM answered with HTTP 200 in 412 ms. A test lead was logged.",
    );
  });

  it("says a test failed, with the CRM's status and what to check", async () => {
    open({
      actions: {
        test: vi.fn(async () => ({
          ok: true as const,
          data: { integrationName: "Sample CRM", ok: false, status: 401, durationMs: 90 },
        })),
      } as unknown as Props["actions"],
    });
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: /Test API/ }));
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent(words.test.failedTitle);
    expect(notice).toHaveTextContent(
      "Sample CRM answered with HTTP 401. Check the API key, then test again.",
    );
  });

  it("says a test got no answer (not allowed, unreachable or too slow) in its own words", async () => {
    open({
      actions: {
        test: vi.fn(async () => ({
          ok: true as const,
          data: { integrationName: "Sample CRM", ok: false, status: null, durationMs: 10000 },
        })),
      } as unknown as Props["actions"],
    });
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: /Test API/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sample CRM did not answer. Check the address, then test again.",
    );
  });

  it("says a test could not run when the action fails, and a vanished connection reads the page again", async () => {
    const conflict = vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const }));
    open({ actions: { test: conflict } as unknown as Props["actions"] });
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: /Test API/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says how long to wait when tests are limited", async () => {
    const limited = vi.fn(async () => ({
      ok: false as const,
      code: "RATE_LIMITED" as const,
      retryAfter: 600,
    }));
    open({ actions: { test: limited } as unknown as Props["actions"] });
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: /Test API/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Too many attempts. Please try again in 10 minutes.",
      ),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("asks before deleting, says what it means, and deletes only on confirm", async () => {
    const { actions } = open();
    const backup = screen.getByRole("article", { name: "Backup CRM" });
    fireEvent.click(within(backup).getByRole("button", { name: "Delete Backup CRM" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete "Backup CRM"?')).toBeVisible();
    expect(within(dialog).getByText(words.deleteDialog.text)).toBeVisible();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: words.deleteDialog.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ integrationId: BACKUP_ID }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Backup CRM deleted"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("does not delete when the question is cancelled", async () => {
    const { actions } = open();
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: "Delete Sample CRM" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: words.cancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actions.remove).not.toHaveBeenCalled();
  });

  it("says a delete that found the connection already gone, and reads the page again", async () => {
    const gone = vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const }));
    open({ actions: { remove: gone } as unknown as Props["actions"] });
    const sample = screen.getByRole("article", { name: "Sample CRM" });
    fireEvent.click(within(sample).getByRole("button", { name: "Delete Sample CRM" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: words.deleteDialog.confirm }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("moves to the logs tab through the address", () => {
    open();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /API logs/ }), { button: 0 });
    expect(router.push).toHaveBeenCalledWith("/admin/crm?tab=logs");
  });
});

describe("the admin's CRM page, API logs tab (S7-T09)", () => {
  const onLogs = (props: Partial<Props> = {}) => open({ tab: "logs", ...props });

  it("lists each call with its time, CRM, form, state, HTTP status, attempt and the start of the answer", () => {
    onLogs();
    const table = screen.getByRole("table", { name: words.logs.caption });
    const row = within(table).getAllByRole("row")[1] as HTMLElement;
    expect(within(row).getByText("Sample CRM")).toBeVisible();
    expect(within(row).getByText("Contact")).toBeVisible();
    expect(within(row).getByText(words.logs.status.failed)).toBeVisible();
    expect(within(row).getByText("502")).toBeVisible();
    expect(within(row).getByText("2")).toBeVisible();
    expect(within(row).getByText("Bad gateway: upstream timed out")).toBeVisible();
    expect(screen.getByText("1 delivery")).toBeVisible();
    expect(
      screen.getByText(
        "Failed deliveries retry automatically after 1, 5, 30, 120 and 720 minutes, up to 6 attempts.",
      ),
    ).toBeVisible();
  });

  it("has no New connection button on this tab", () => {
    onLogs();
    expect(screen.queryByRole("link", { name: words.new })).toBeNull();
  });

  it("shows a dash for no status, no form and no answer, and cuts a long answer to its start", () => {
    onLogs({
      logs: {
        failedSubmissions: 0,
        logs: [
          log("1", {
            httpStatus: null,
            formName: null,
            snippet: null,
            retryable: false,
            submissionId: null,
          }),
          log("2", { snippet: "x".repeat(300), retryable: false }),
        ],
      },
    });
    const table = screen.getByRole("table", { name: words.logs.caption });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first as HTMLElement).getAllByText(words.dash).length).toBeGreaterThanOrEqual(3);
    expect(within(second as HTMLElement).getByText(`${"x".repeat(140)}…`)).toBeVisible();
  });

  it("says a success is a success", () => {
    onLogs({
      logs: {
        failedSubmissions: 0,
        logs: [log("1", { outcome: "success", httpStatus: 200, retryable: false })],
      },
    });
    expect(screen.getByText(words.logs.status.success)).toBeVisible();
  });

  it("says the newest number when the log is at its limit", () => {
    const many = Array.from({ length: 100 }, (_unused, index) =>
      log(String(index), { retryable: false, submissionId: null }),
    );
    onLogs({ logs: { logs: many, failedSubmissions: 0 } });
    expect(screen.getByText("The newest 100 deliveries")).toBeVisible();
  });

  it("says there are no deliveries yet", () => {
    onLogs({ logs: { logs: [], failedSubmissions: 0 } });
    expect(screen.getByText(words.logs.empty.title)).toBeVisible();
    expect(screen.getByText(words.logs.empty.text)).toBeVisible();
  });

  it("offers Retry only on the lines the page marks, and sends that submission", async () => {
    const { actions } = onLogs({
      logs: {
        failedSubmissions: 1,
        logs: [log("1"), log("2", { retryable: false, attempt: 1 })],
      },
    });
    const buttons = screen.getAllByRole("button", { name: /^Retry/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    await waitFor(() => expect(actions.retry).toHaveBeenCalledWith({ submissionId: SUBMISSION }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toast.retried, {
        description: words.toast.retriedText,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says when the retry failed again, with the CRM's status, or with no answer", async () => {
    const answers = [
      { status: 502, text: "The CRM answered HTTP 502. The next try is scheduled." },
      { status: null, text: "The CRM did not answer. The next try is scheduled." },
    ];
    for (const answer of answers) {
      vi.clearAllMocks();
      const retry = vi.fn(async () => ({
        ok: true as const,
        data: { submissionId: SUBMISSION, ok: false, status: answer.status },
      }));
      const { unmount } = onLogs({ actions: { retry } as unknown as Props["actions"] });
      fireEvent.click(screen.getByRole("button", { name: /^Retry/ }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(words.toast.retryFailed, {
          description: answer.text,
        }),
      );
      expect(router.refresh).toHaveBeenCalled();
      unmount();
    }
  });

  it("says a submission cannot be sent now, and reads the page again", async () => {
    const retry = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    onLogs({ actions: { retry } as unknown as Props["actions"] });
    fireEvent.click(screen.getByRole("button", { name: /^Retry/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.toast.retryConflict));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("moves to the connections tab through the address", () => {
    onLogs();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Connections/ }), { button: 0 });
    expect(router.push).toHaveBeenCalledWith("/admin/crm");
  });
});
