// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SubmissionDetail, type SubmissionDetailProps } from "../submission-detail";
import { SubmissionsFilters, type SubmissionsFiltersProps } from "../submissions-filters";
import { SubmissionsTable, type SubmissionRow } from "../submissions-table";
import { StatusBadge } from "@/components/patterns/status-badge";

const COLUMNS = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  project: "Project",
  source: "Source",
  form: "Form",
  crm: "CRM",
  actions: "Actions",
};

function row(id: string, extra: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id,
    created: "28 Oct, 11:02",
    name: "Priya Raman",
    mobile: { text: "98400 12345", href: "tel:9840012345" },
    project: "Kadal Vista",
    source: "project_page",
    form: "Enquiry form",
    crm: <StatusBadge kind="crm" status="success" />,
    openLabel: "Details",
    openFor: "Priya Raman",
    onOpen: vi.fn(),
    ...extra,
  };
}

describe("SubmissionsTable: the forms people filled in (S7-T07)", () => {
  it("is a table with a heading for each of the eight columns and a row for each submission", () => {
    renderWithMessages(
      <SubmissionsTable
        caption="Form submissions"
        columns={COLUMNS}
        rows={[row("1"), row("2", { name: "Anand V", openFor: "Anand V" })]}
        noMobile="—"
        countText="2 submissions"
      />,
    );
    const table = screen.getByRole("table", { name: "Form submissions" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByText("Anand V")[0]).toBeVisible();
    expect(screen.getByText("2 submissions")).toBeVisible();
  });

  it("makes the mobile number a call link, and shows what it is given when there is none", () => {
    renderWithMessages(
      <SubmissionsTable
        caption="c"
        columns={COLUMNS}
        rows={[row("1"), row("2", { mobile: null })]}
        noMobile="—"
        countText="2"
      />,
    );
    expect(screen.getByRole("link", { name: "98400 12345" })).toHaveAttribute(
      "href",
      "tel:9840012345",
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("names each Details button by its word and the person, and runs what it was given", () => {
    const first = row("1");
    renderWithMessages(
      <SubmissionsTable caption="c" columns={COLUMNS} rows={[first]} noMobile="—" countText="1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Details Priya Raman" }));
    expect(first.onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the CRM state as a word, and the note under the list only when given", () => {
    renderWithMessages(
      <SubmissionsTable
        caption="c"
        columns={COLUMNS}
        rows={[row("1")]}
        noMobile="—"
        countText="1 submission"
        note="Select Details to see the full submission."
      />,
    );
    expect(screen.getByText("Delivered")).toBeVisible();
    expect(screen.getByText("Select Details to see the full submission.")).toBeVisible();
  });
});

const FILTER_OPTIONS: SubmissionsFiltersProps["options"] = {
  ranges: [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
  ],
  forms: [{ value: "enquiry", label: "Enquiry form" }],
  projects: [{ value: "vista", label: "Kadal Vista" }],
  sources: [{ value: "project_page", label: "project_page" }],
  crms: [
    { value: "any", label: "Any" },
    { value: "failed", label: "Failed" },
  ],
};

const FILTER_WORDS: SubmissionsFiltersProps["words"] = {
  range: "Date range",
  form: "Form",
  project: "Project",
  source: "Source",
  crm: "CRM status",
  allForms: "All forms",
  allProjects: "All projects",
  allSources: "All sources",
  reset: "Reset",
};

function filters(extra: Partial<SubmissionsFiltersProps> = {}) {
  const props: SubmissionsFiltersProps = {
    values: { range: "30", form: "", project: "", source: "", crm: "any" },
    options: FILTER_OPTIONS,
    words: FILTER_WORDS,
    onChange: vi.fn(),
    onReset: vi.fn(),
    ...extra,
  };
  renderWithMessages(<SubmissionsFilters {...props} />);
  return props;
}

describe("SubmissionsFilters: the boxes above the list (S7-T07)", () => {
  it("has a box for each choice with its label and its chosen value, and the All choices where there are any", () => {
    filters();
    expect(screen.getByLabelText("Date range")).toHaveValue("30");
    expect(screen.getByLabelText("Form")).toHaveValue("");
    expect(
      within(screen.getByLabelText("Form")).getByRole("option", { name: "All forms" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("CRM status")).toHaveValue("any");
    expect(
      within(screen.getByLabelText("Date range")).queryByRole("option", { name: /^All/ }),
    ).toBeNull();
  });

  it("tells the page which box changed and to what", () => {
    const props = filters();
    fireEvent.change(screen.getByLabelText("Date range"), { target: { value: "7" } });
    expect(props.onChange).toHaveBeenCalledWith("range", "7");
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "vista" } });
    expect(props.onChange).toHaveBeenCalledWith("project", "vista");
    fireEvent.change(screen.getByLabelText("CRM status"), { target: { value: "failed" } });
    expect(props.onChange).toHaveBeenCalledWith("crm", "failed");
  });

  it("clears the choice with Reset", () => {
    const props = filters();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });
});

const DETAIL_WORDS: SubmissionDetailProps["words"] = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  email: "Email",
  form: "Form",
  project: "Project",
  source: "Source",
  answers: "Answers",
  crm: "CRM",
  crmId: "CRM id",
};

function detail(extra: Partial<SubmissionDetailProps> = {}) {
  const props: SubmissionDetailProps = {
    details: {
      created: "28 Oct 2026, 10:31",
      name: "Anand V",
      mobile: { text: "99620 11876", href: "tel:9962011876" },
      email: "—",
      form: "Contact",
      project: "—",
      source: "contact_page",
    },
    noMobile: "—",
    answers: [{ id: "message", label: "Message", value: "I would like to speak about my plot." }],
    crm: { badge: <StatusBadge kind="crm" status="failed" /> },
    words: DETAIL_WORDS,
    ...extra,
  };
  renderWithMessages(<SubmissionDetail {...props} />);
  return props;
}

describe("SubmissionDetail: one submission in full (S7-T07)", () => {
  it("lists each field with its label, the mobile as a call link, and the answers under their own heading", () => {
    detail();
    expect(screen.getByText("Created").nextElementSibling).toHaveTextContent("28 Oct 2026, 10:31");
    expect(screen.getByRole("link", { name: "99620 11876" })).toHaveAttribute(
      "href",
      "tel:9962011876",
    );
    const answers = screen.getByRole("region", { name: "Answers" });
    expect(within(answers).getByText("Message")).toBeVisible();
    expect(within(answers).getByText("I would like to speak about my plot.")).toBeVisible();
  });

  it("leaves out the answers' heading when there are none", () => {
    detail({ answers: [] });
    expect(screen.queryByRole("region", { name: "Answers" })).toBeNull();
  });

  it("shows what it is given for a mobile that was not given", () => {
    detail({
      details: {
        created: "26 Oct 2026, 09:00",
        name: "Meena S",
        mobile: null,
        email: "meena@example.com",
        form: "Newsletter",
        project: "p",
        source: "s",
      },
    });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Mobile").nextElementSibling).toHaveTextContent("—");
  });

  it("says why a delivery failed, in an alert that is read at once, and shows the CRM's id once delivered", () => {
    detail({
      failure: { title: "CRM delivery failed", text: "HTTP 502 on attempt 2." },
      crm: { badge: <StatusBadge kind="crm" status="failed" />, leadId: "CRM-4821" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("CRM delivery failed");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 502 on attempt 2.");
    expect(screen.getByText("CRM id CRM-4821")).toBeVisible();
  });

  it("has no alert for a delivery that did not fail", () => {
    detail({ crm: { badge: <StatusBadge kind="crm" status="success" /> } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
