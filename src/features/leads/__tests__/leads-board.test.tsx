// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { CrmFilter, SubmissionRange } from "../constants";
import type { LeadsBoardActions } from "../leads-board.client";
import type { LeadCounts, LeadView, LeadsPage, SubmissionView, SubmissionsPage } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { LeadsBoard } = await import("../leads-board.client");

const words = en.admin.leads;

type ChosenFilters = {
  range: SubmissionRange;
  crm: CrmFilter;
  form: string;
  project: string;
  source: string;
};
const COUNTS: LeadCounts = { leads: 862, submissions: 1104 };
const READ_AT = Date.parse("2026-11-08T10:00:00.000Z");

const lead = (id: string, extra: Partial<LeadView> = {}): LeadView => ({
  id,
  projectId: "00000000-0000-4000-b000-000000000001",
  projectName: "Kadal Vista",
  kind: "enquiry",
  name: `Person ${id}`,
  phone: "9841055512",
  email: "person@example.com",
  message: "Is a 3 BHK available?",
  visitDate: null,
  status: "new",
  createdAt: "2026-10-28T05:12:00+00:00",
  ...extra,
});

const submission = (id: string, extra: Partial<SubmissionView> = {}): SubmissionView => ({
  id,
  formName: "Enquiry form",
  projectName: "Kadal Vista",
  name: `Person ${id}`,
  mobile: "9840012345",
  email: null,
  source: "project_page",
  agentName: "Sales team",
  crm: {
    status: "success",
    httpStatus: null,
    attempts: 1,
    nextRetryAt: null,
    lastError: null,
    leadId: "CRM-4821",
  },
  answers: [
    { key: "budget", label: "Budget", value: "1 Cr" },
    { key: "wants", label: "What they want", value: ["Parking", "Gym"] },
  ],
  createdAt: "2026-10-28T05:32:00+00:00",
  ...extra,
});

const FAILED = submission("2", {
  crm: {
    status: "failed",
    httpStatus: 502,
    attempts: 2,
    nextRetryAt: "2026-11-08T10:30:00.000Z",
    lastError: "HTTP 502",
    leadId: null,
  },
});

function actions(extra: Partial<LeadsBoardActions> = {}): LeadsBoardActions {
  return {
    setStatus: vi.fn(async (input) => ({
      ok: true as const,
      data: { leadId: input.leadId, projectId: "p", status: input.status },
    })),
    loadMore: vi.fn(async () => ({
      ok: true as const,
      data: { leads: [lead("9")], total: 3, nextCursor: null },
    })),
    loadMoreSubmissions: vi.fn(async () => ({
      ok: true as const,
      data: { submissions: [submission("9")], total: 3, nextCursor: null, readAt: READ_AT },
    })),
    retryDelivery: vi.fn(async (input) => ({
      ok: true as const,
      data: { submissionId: input.submissionId, ok: true, status: 200 },
    })),
    ...extra,
  };
}

function leadsTab(page: Partial<LeadsPage> = {}, given: LeadsBoardActions = actions()) {
  renderWithMessages(
    <LeadsBoard
      tab="leads"
      counts={COUNTS}
      actions={given}
      leads={{ leads: [lead("1"), lead("2")], total: 2, nextCursor: null, ...page }}
    />,
  );
  return given;
}

function submissionsTab(
  page: Partial<SubmissionsPage> = {},
  filters: Partial<ChosenFilters> = {},
  given: LeadsBoardActions = actions(),
) {
  renderWithMessages(
    <LeadsBoard
      tab="submissions"
      counts={COUNTS}
      actions={given}
      submissions={{
        submissions: [submission("1"), FAILED],
        total: 2,
        nextCursor: null,
        readAt: READ_AT,
        ...page,
      }}
      filters={{ range: "30", crm: "any", ...filters }}
      options={{
        projects: [{ id: "p1", name: "Kadal Vista" }],
        forms: [{ id: "f1", name: "Enquiry form" }],
        sources: ["project_page", "contact_page"],
      }}
    />,
  );
  return given;
}

function renderSubmissionsWith(given: LeadsBoardActions) {
  return renderWithMessages(
    <LeadsBoard
      tab="submissions"
      counts={COUNTS}
      actions={given}
      submissions={{
        submissions: [submission("1"), FAILED],
        total: 2,
        nextCursor: null,
        readAt: READ_AT,
      }}
      filters={{ range: "30", crm: "any" }}
      options={{ projects: [], forms: [], sources: [] }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LeadsBoard: the admin's Leads page, the shell (S7-T07)", () => {
  it("shows the heading and two tabs with their numbers, the open one selected", () => {
    leadsTab();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    const open = screen.getByRole("tab", { name: /Project leads/ });
    expect(open).toHaveAttribute("aria-selected", "true");
    expect(open).toHaveTextContent("862");
    expect(screen.getByRole("tab", { name: /Form submissions/ })).toHaveTextContent("1,104");
  });

  it("goes to the address of the other tab when it is chosen", () => {
    leadsTab();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Form submissions/ }), { button: 0 });
    expect(router.push).toHaveBeenCalledWith("/admin/leads?tab=submissions");
  });
});

describe("LeadsBoard: the Project leads tab (S7-T07)", () => {
  it("shows a row for each lead with its date, type as a word, a call link and the state", () => {
    leadsTab({ total: 862 });
    const table = screen.getByRole("table", { name: words.table.caption });
    expect(within(table).getAllByText("Kadal Vista")).toHaveLength(2);
    expect(within(table).getAllByText("Enquiry")).toHaveLength(2);
    expect(within(table).getAllByRole("link", { name: "98410 55512" })[0]).toHaveAttribute(
      "href",
      "tel:9841055512",
    );
    expect(within(table).getAllByText(/^28 Oct 2026, /)).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Status for Person 1" })).toHaveValue("new");
    expect(screen.getByText("2 of 862 leads")).toBeVisible();
  });

  it("shows a dash for a missing email or message and the words for a site visit", () => {
    leadsTab({
      leads: [lead("1", { email: null, message: null, kind: "site_visit" })],
      total: 1,
    });
    expect(screen.getAllByText(words.dash)).toHaveLength(2);
    expect(screen.getByText("Site visit")).toBeVisible();
  });

  it("saves a state as soon as it is chosen and shows the new one", async () => {
    const given = leadsTab();
    const box = screen.getByRole("combobox", { name: "Status for Person 1" });
    fireEvent.change(box, { target: { value: "contacted" } });
    await waitFor(() =>
      expect(given.setStatus).toHaveBeenCalledWith({
        leadId: "1",
        status: "contacted",
      }),
    );
    expect(box).toHaveValue("contacted");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("puts the old state back, says so in words and reads the page again when the save fails", async () => {
    leadsTab(
      {},
      actions({
        setStatus: vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const })),
      }),
    );
    const box = screen.getByRole("combobox", { name: "Status for Person 1" });
    fireEvent.change(box, { target: { value: "closed" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(box).toHaveValue("new");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows Show more only when there are more leads, adds them in place, and then stops", async () => {
    const given = leadsTab({ total: 3, nextCursor: "cursor-1" });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.leads }));
    await waitFor(() =>
      expect(given.loadMore).toHaveBeenCalledWith({ status: "all", after: "cursor-1" }),
    );
    expect(await screen.findByRole("combobox", { name: "Status for Person 9" })).toBeVisible();
    expect(screen.queryByRole("button", { name: words.showMore.leads })).toBeNull();
  });

  it("shows the empty page when there are no leads", () => {
    leadsTab({ leads: [], total: 0 });
    expect(screen.getByRole("heading", { name: words.empty.title })).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("LeadsBoard: the Form submissions tab (S7-T07)", () => {
  it("shows the filters with the chosen values and a row for each submission with its CRM state", () => {
    submissionsTab({ total: 1104 });
    expect(screen.getByLabelText(words.submissions.filters.range)).toHaveValue("30");
    expect(screen.getByLabelText(words.submissions.filters.crm)).toHaveValue("any");
    const table = screen.getByRole("table", { name: words.submissions.table.caption });
    expect(within(table).getByText("Delivered")).toBeVisible();
    expect(within(table).getByText("Failed")).toBeVisible();
    expect(within(table).getByText("CRM-4821")).toBeVisible();
    expect(screen.getByText("2 of 1,104 submissions")).toBeVisible();
    expect(screen.getByText(words.submissions.note)).toBeVisible();
  });

  it("goes to the address for a filter choice, keeping the other choices, and drops a choice put back to its default", () => {
    submissionsTab({}, { crm: "failed", project: "p1" });
    fireEvent.change(screen.getByLabelText(words.submissions.filters.range), {
      target: { value: "7" },
    });
    expect(router.push).toHaveBeenLastCalledWith(
      "/admin/leads?tab=submissions&range=7&project=p1&crm=failed",
    );
    fireEvent.change(screen.getByLabelText(words.submissions.filters.project), {
      target: { value: "" },
    });
    expect(router.push).toHaveBeenLastCalledWith("/admin/leads?tab=submissions&crm=failed");
  });

  it("clears every choice with Reset", () => {
    submissionsTab({}, { crm: "failed", range: "7" });
    fireEvent.click(screen.getByRole("button", { name: words.submissions.filters.reset }));
    expect(router.push).toHaveBeenCalledWith("/admin/leads?tab=submissions");
  });

  it("opens the whole submission with its answers, its fields and the CRM id", async () => {
    submissionsTab();
    fireEvent.click(screen.getByRole("button", { name: "Details Person 1" }));
    const drawer = await screen.findByRole("dialog", { name: words.detail.title });
    expect(within(drawer).getByText("Budget")).toBeVisible();
    expect(within(drawer).getByText("1 Cr")).toBeVisible();
    expect(within(drawer).getByText("Parking, Gym")).toBeVisible();
    expect(within(drawer).getByRole("link", { name: "98400 12345" })).toHaveAttribute(
      "href",
      "tel:9840012345",
    );
    expect(within(drawer).getByText("CRM id CRM-4821")).toBeVisible();
    expect(within(drawer).queryByRole("alert")).toBeNull();
  });

  it("says why a delivery failed and when it will be tried again, from the moment the page was read", async () => {
    submissionsTab();
    fireEvent.click(screen.getByRole("button", { name: "Details Person 2" }));
    const drawer = await screen.findByRole("dialog", { name: words.detail.title });
    expect(within(drawer).getByRole("alert")).toHaveTextContent(words.detail.failed.title);
    expect(within(drawer).getByRole("alert")).toHaveTextContent(
      "HTTP 502 on attempt 2. The next automatic retry is in 30 minutes.",
    );
  });

  it("shows the CRM connection that took each submission in an Agent column, and a dash when none did (S7-T09)", () => {
    submissionsTab({
      submissions: [submission("1"), submission("4", { agentName: null })],
      total: 2,
    });
    const table = screen.getByRole("table", { name: words.submissions.table.caption });
    expect(
      within(table).getByRole("columnheader", { name: words.submissions.table.agent }),
    ).toBeVisible();
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1] as HTMLElement).getByText("Sales team")).toBeVisible();
    expect(within(rows[2] as HTMLElement).queryByText("Sales team")).toBeNull();
    expect(within(rows[2] as HTMLElement).getAllByText(words.dash).length).toBeGreaterThan(0);
  });

  it("offers Retry delivery now only under a failed delivery, and sends that submission to its CRM (S7-T09)", async () => {
    const given = actions();
    const { unmount } = renderSubmissionsWith(given);
    fireEvent.click(screen.getByRole("button", { name: "Details Person 1" }));
    const first = await screen.findByRole("dialog", { name: words.detail.title });
    expect(within(first).queryByRole("button", { name: words.detail.retry })).toBeNull();
    unmount();

    renderSubmissionsWith(given);
    fireEvent.click(screen.getByRole("button", { name: "Details Person 2" }));
    const drawer = await screen.findByRole("dialog", { name: words.detail.title });
    fireEvent.click(within(drawer).getByRole("button", { name: words.detail.retry }));
    await waitFor(() => expect(given.retryDelivery).toHaveBeenCalledWith({ submissionId: "2" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(en.admin.crm.toast.retried, {
        description: en.admin.crm.toast.retriedText,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says when the CRM answered the retry with a failure, with its code, or with no answer", async () => {
    const answers = [
      { ok: false, status: 502, text: "The CRM answered HTTP 502. The next try is scheduled." },
      { ok: false, status: null, text: "The CRM did not answer. The next try is scheduled." },
    ];
    for (const answer of answers) {
      vi.clearAllMocks();
      const retryDelivery = vi.fn(async () => ({
        ok: true as const,
        data: { submissionId: "2", ok: answer.ok, status: answer.status },
      }));
      const { unmount } = renderSubmissionsWith(actions({ retryDelivery }));
      fireEvent.click(screen.getByRole("button", { name: "Details Person 2" }));
      const drawer = await screen.findByRole("dialog", { name: words.detail.title });
      fireEvent.click(within(drawer).getByRole("button", { name: words.detail.retry }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(en.admin.crm.toast.retryFailed, {
          description: answer.text,
        }),
      );
      unmount();
    }
  });

  it("says the submission cannot be sent now (already sent, or its connection is off) and reads the page again", async () => {
    const retryDelivery = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    renderSubmissionsWith(actions({ retryDelivery }));
    fireEvent.click(screen.getByRole("button", { name: "Details Person 2" }));
    const drawer = await screen.findByRole("dialog", { name: words.detail.title });
    fireEvent.click(within(drawer).getByRole("button", { name: words.detail.retry }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.admin.crm.toast.retryConflict));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says no more retries are planned when none is due, and names a failure that has no code", async () => {
    submissionsTab({
      submissions: [
        submission("3", {
          crm: {
            status: "failed",
            httpStatus: null,
            attempts: 6,
            nextRetryAt: null,
            lastError: null,
            leadId: null,
          },
        }),
      ],
      total: 1,
    });
    fireEvent.click(screen.getByRole("button", { name: "Details Person 3" }));
    const drawer = await screen.findByRole("dialog", { name: words.detail.title });
    expect(within(drawer).getByRole("alert")).toHaveTextContent(
      "The delivery failed on attempt 6. No more automatic retries are planned.",
    );
  });

  it("shows Show more only when there are more submissions, and adds them in place", async () => {
    const given = submissionsTab({ total: 3, nextCursor: "cursor-1" }, { crm: "failed" });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.submissions }));
    await waitFor(() =>
      expect(given.loadMoreSubmissions).toHaveBeenCalledWith({
        range: "30",
        crm: "failed",
        after: "cursor-1",
      }),
    );
    expect(await screen.findByRole("button", { name: "Details Person 9" })).toBeVisible();
    expect(screen.queryByRole("button", { name: words.showMore.submissions })).toBeNull();
  });

  it("says nothing matches when filters are on and there are no submissions, and that there are none otherwise", () => {
    submissionsTab({ submissions: [], total: 0 }, { crm: "failed" });
    expect(screen.getByRole("heading", { name: words.submissions.noMatch.title })).toBeVisible();
  });

  it("says there are no submissions yet when nothing is filtered and the list is empty", () => {
    submissionsTab({ submissions: [], total: 0 });
    expect(screen.getByRole("heading", { name: words.submissions.empty.title })).toBeVisible();
  });
});
