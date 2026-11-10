// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import {
  CrmConnectionFields,
  CrmCredentialField,
  type CrmConnectionValues,
} from "../crm-connection-fields";
import { CrmConnectionCards, CrmPageHeader, type CrmConnectionView } from "../crm-connections";
import { CrmLogsTable, type CrmLogRow } from "../crm-logs-table";
import { CrmRowsEditor, type CrmRow } from "../crm-rows-editor";
import { SubmissionDetail, type SubmissionDetailProps } from "../submission-detail";
import { SubmissionsTable, type SubmissionRow } from "../submissions-table";

const WORDS = {
  endpoint: "Endpoint",
  secretSet: "Set",
  secretNotSet: "Not set",
  secretsNote: "Secret values are stored on the server and are never shown again.",
};
const EMPTY = {
  title: "No connections yet",
  text: "Add a CRM connection to send form submissions to it.",
  action: { label: "New connection", href: "/admin/crm/new" },
};

function connection(change: Partial<CrmConnectionView> = {}): CrmConnectionView {
  return {
    id: "sample",
    name: "Sample CRM",
    state: { label: "Active", active: true },
    endpoint: "POST https://api.crm.example/v2/leads",
    secrets: [
      { label: "API key", set: true },
      { label: "API secret", set: false },
    ],
    test: { label: "Test API", onClick: vi.fn() },
    edit: { href: "/admin/crm/sample", label: "Edit", forName: "Sample CRM" },
    remove: { label: "Delete Sample CRM", onClick: vi.fn() },
    ...change,
  };
}

describe("CrmPageHeader: the heading of the CRM page (S7-T09)", () => {
  it("has the heading, the line under it, and New connection as a link", () => {
    renderWithMessages(
      <CrmPageHeader
        title="CRM integrations"
        intro="Send form submissions to your CRM."
        action={{ label: "New connection", href: "/admin/crm/new" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "CRM integrations" })).toBeVisible();
    expect(screen.getByText("Send form submissions to your CRM.")).toBeVisible();
    expect(screen.getByRole("link", { name: "New connection" })).toHaveAttribute(
      "href",
      "/admin/crm/new",
    );
  });

  it("can be a level-2 heading, and has no button when there is no action", () => {
    renderWithMessages(<CrmPageHeader title="CRM" headingLevel="h2" intro="x" />);
    expect(screen.getByRole("heading", { level: 2, name: "CRM" })).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("CrmConnectionCards: the connections (S7-T09, BR-64)", () => {
  it("draws a card for each connection, named by its heading, with its state and where it sends", () => {
    renderWithMessages(
      <CrmConnectionCards
        connections={[connection(), connection({ id: "backup", name: "Backup CRM" })]}
        words={WORDS}
        empty={EMPTY}
      />,
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(
      within(cards[0] as HTMLElement).getByRole("heading", { name: "Sample CRM" }),
    ).toBeVisible();
    expect(within(cards[0] as HTMLElement).getByText("Active")).toBeVisible();
    expect(
      within(cards[0] as HTMLElement).getByText("POST https://api.crm.example/v2/leads"),
    ).toBeVisible();
  });

  it("says in words whether each secret is set, and never has a value to show", () => {
    renderWithMessages(
      <CrmConnectionCards connections={[connection()]} words={WORDS} empty={EMPTY} />,
    );
    expect(screen.getByText("API key").closest("div")).toHaveTextContent("Set");
    expect(screen.getByText("API secret").closest("div")).toHaveTextContent("Not set");
    expect(screen.getByText(WORDS.secretsNote)).toBeVisible();
  });

  it("leaves out the secrets and the note for a connection that has none to show", () => {
    renderWithMessages(
      <CrmConnectionCards
        connections={[connection({ secrets: [] })]}
        words={WORDS}
        empty={EMPTY}
      />,
    );
    expect(screen.queryByText(WORDS.secretsNote)).toBeNull();
    expect(screen.queryByText("API key")).toBeNull();
  });

  it("runs Test API, links Edit, and asks to delete, each naming the connection", () => {
    const test = vi.fn();
    const remove = vi.fn();
    renderWithMessages(
      <CrmConnectionCards
        connections={[
          connection({
            test: { label: "Test API", onClick: test },
            remove: { label: "Delete Sample CRM", onClick: remove },
          }),
        ]}
        words={WORDS}
        empty={EMPTY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Test API Sample CRM" }));
    expect(test).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Edit Sample CRM" })).toHaveAttribute(
      "href",
      "/admin/crm/sample",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Sample CRM" }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("turns Test API off for an inactive connection, and has no delete button when none is given", () => {
    renderWithMessages(
      <CrmConnectionCards
        connections={[
          connection({
            state: { label: "Inactive", active: false },
            test: { label: "Test API", onClick: vi.fn(), disabled: true },
            remove: undefined,
          }),
        ]}
        words={WORDS}
        empty={EMPTY}
      />,
    );
    expect(screen.getByRole("button", { name: "Test API Sample CRM" })).toBeDisabled();
    expect(screen.getByText("Inactive")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete Sample CRM" })).toBeNull();
  });

  it("marks a test that is running as busy, and shows a notice above the cards", () => {
    renderWithMessages(
      <CrmConnectionCards
        connections={[connection({ test: { label: "Test API", onClick: vi.fn(), pending: true } })]}
        words={WORDS}
        empty={EMPTY}
        notice={<p>Test succeeded</p>}
      />,
    );
    expect(screen.getByRole("button", { name: "Test API Sample CRM" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Test succeeded")).toBeVisible();
  });

  it("shows the empty state with New connection when there are none", () => {
    renderWithMessages(<CrmConnectionCards connections={[]} words={WORDS} empty={EMPTY} />);
    expect(screen.getByText("No connections yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "New connection" })).toHaveAttribute(
      "href",
      "/admin/crm/new",
    );
    expect(screen.queryByRole("article")).toBeNull();
  });
});

const LOG_COLUMNS = {
  time: "Time",
  crm: "CRM",
  form: "Form",
  status: "Status",
  http: "HTTP",
  attempt: "Attempt",
  response: "Response",
  actions: "Actions",
};
const LOG_EMPTY = { title: "No deliveries yet", text: "Calls to your CRMs show here." };

function log(id: string, change: Partial<CrmLogRow> = {}): CrmLogRow {
  return {
    id,
    time: "28 Oct, 10:31",
    crm: "Sample CRM",
    form: "Contact",
    status: "Failed",
    http: "502",
    attempt: "2",
    response: "Bad gateway: upstream timed out",
    retry: { label: "Retry", forName: "Sample CRM, 28 Oct, 10:31", onClick: vi.fn() },
    ...change,
  };
}

describe("CrmLogsTable: what was sent to the CRMs (S7-T09)", () => {
  it("is a table with a heading for each of the eight columns and a row for each call", () => {
    renderWithMessages(
      <CrmLogsTable
        caption="API logs"
        columns={LOG_COLUMNS}
        rows={[log("1"), log("2", { retry: undefined, status: "Success", http: "200" })]}
        countText="2 deliveries"
        note="Failed deliveries retry automatically."
        empty={LOG_EMPTY}
      />,
    );
    const table = screen.getByRole("table", { name: "API logs" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("2 deliveries")).toBeVisible();
    expect(screen.getByText("Failed deliveries retry automatically.")).toBeVisible();
  });

  it("has Retry only on the rows that were given one, and says which call it is for", () => {
    const retry = vi.fn();
    renderWithMessages(
      <CrmLogsTable
        caption="API logs"
        columns={LOG_COLUMNS}
        rows={[
          log("1", {
            retry: { label: "Retry", forName: "Sample CRM, 28 Oct, 10:31", onClick: retry },
          }),
          log("2", { retry: undefined }),
        ]}
        countText="2"
        empty={LOG_EMPTY}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /Retry/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Retry Sample CRM, 28 Oct, 10:31");
    fireEvent.click(buttons[0] as HTMLElement);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("marks a retry that is running as busy", () => {
    renderWithMessages(
      <CrmLogsTable
        caption="API logs"
        columns={LOG_COLUMNS}
        rows={[
          log("1", { retry: { label: "Retry", forName: "x", onClick: vi.fn(), pending: true } }),
        ]}
        countText="1"
        empty={LOG_EMPTY}
      />,
    );
    expect(screen.getByRole("button", { name: /Retry/ })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the empty state, and no table, when there are no calls", () => {
    renderWithMessages(
      <CrmLogsTable
        caption="API logs"
        columns={LOG_COLUMNS}
        rows={[]}
        countText="0"
        empty={LOG_EMPTY}
      />,
    );
    expect(screen.getByText("No deliveries yet")).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

const VALUES: CrmConnectionValues = {
  name: "Sample CRM",
  leadSource: "Find Prop website",
  baseUrl: "https://api.crm.example",
  endpoint: "/v2/leads",
  method: "POST",
  leadIdPath: "data.lead.id",
  active: true,
};
const FIELD_WORDS = {
  name: "Name",
  leadSource: "Lead source",
  baseUrl: "Base URL",
  baseUrlHint: "Use an https address on a public domain.",
  endpoint: "Endpoint",
  method: "HTTP method",
  leadIdPath: "Lead ID path",
  status: "Status",
  active: "Active",
};

describe("CrmConnectionFields: the Connection box (S7-T09, BR-65)", () => {
  const draw = (extra: Partial<React.ComponentProps<typeof CrmConnectionFields>> = {}) => {
    const onChange = vi.fn();
    renderWithMessages(
      <CrmConnectionFields
        values={VALUES}
        onChange={onChange}
        methods={[
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
        ]}
        words={FIELD_WORDS}
        {...extra}
      />,
    );
    return onChange;
  };

  it("has every box with its label, filled with what it is given, and marks name and base URL as needed", () => {
    draw();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Sample CRM");
    expect(screen.getByLabelText(/^Base URL/)).toHaveValue("https://api.crm.example");
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/v2/leads");
    expect(screen.getByLabelText("HTTP method")).toHaveValue("POST");
    expect(screen.getByLabelText("Lead ID path")).toHaveValue("data.lead.id");
    expect(screen.getByLabelText(/^Name/)).toBeRequired();
    expect(screen.getByLabelText(/^Base URL/)).toBeRequired();
  });

  it("tells what is typed, chosen and switched, by box", () => {
    const onChange = draw();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Backup CRM" } });
    expect(onChange).toHaveBeenCalledWith("name", "Backup CRM");
    fireEvent.change(screen.getByLabelText("HTTP method"), { target: { value: "PUT" } });
    expect(onChange).toHaveBeenCalledWith("method", "PUT");
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("active", false);
  });

  it("shows the hint under the base URL, and the error in its place when there is one", () => {
    draw();
    expect(screen.getByText("Use an https address on a public domain.")).toBeVisible();
  });

  it("shows an error under its box, sets the box invalid, and drops the hint", () => {
    draw({ errors: { baseUrl: "Must be https and a public address." } });
    expect(screen.getByText("Must be https and a public address.")).toBeVisible();
    expect(screen.getByLabelText(/^Base URL/)).toBeInvalid();
    expect(screen.queryByText("Use an https address on a public domain.")).toBeNull();
  });

  it("turns every box off while saving", () => {
    draw({ disabled: true });
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getByLabelText("HTTP method")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

const CREDENTIAL_WORDS = {
  replace: "Replace",
  clear: "Clear",
  undo: "Undo",
  cancel: "Cancel",
  notSet: "Not set",
  willClear: "Will be removed when you save.",
};

describe("CrmCredentialField: a secret that is never shown (S7-T09, BR-64)", () => {
  const draw = (change: Partial<React.ComponentProps<typeof CrmCredentialField>> = {}) => {
    const onModeChange = vi.fn();
    const onValueChange = vi.fn();
    renderWithMessages(
      <CrmCredentialField
        label="API key"
        stored
        mode="keep"
        value=""
        onModeChange={onModeChange}
        onValueChange={onValueChange}
        words={CREDENTIAL_WORDS}
        {...change}
      />,
    );
    return { onModeChange, onValueChange };
  };

  it("shows a saved secret as dots in a read-only box, with Replace and Clear that name it", () => {
    draw();
    const box = screen.getByLabelText("API key");
    expect(box).toHaveAttribute("readonly");
    expect(box).toHaveValue("••••••••••••••••");
    expect(screen.getByRole("button", { name: "Replace API key" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear API key" })).toBeVisible();
  });

  it("asks to replace or clear when those are pressed", () => {
    const { onModeChange } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Replace API key" }));
    expect(onModeChange).toHaveBeenLastCalledWith("replace");
    fireEvent.click(screen.getByRole("button", { name: "Clear API key" }));
    expect(onModeChange).toHaveBeenLastCalledWith("clear");
  });

  it("while replacing, is a password box that does not autofill, with Cancel to keep the saved one", () => {
    const { onModeChange, onValueChange } = draw({ mode: "replace", value: "abc" });
    const box = screen.getByLabelText("API key");
    expect(box).toHaveAttribute("type", "password");
    expect(box).toHaveAttribute("autocomplete", "new-password");
    expect(box).toHaveValue("abc");
    fireEvent.change(box, { target: { value: "abcd" } });
    expect(onValueChange).toHaveBeenCalledWith("abcd");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onModeChange).toHaveBeenCalledWith("keep");
  });

  it("after Clear, says what saving will do, and Undo goes back", () => {
    const { onModeChange } = draw({ mode: "clear" });
    expect(screen.getByLabelText("API key")).toHaveValue("Will be removed when you save.");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onModeChange).toHaveBeenCalledWith("keep");
    expect(screen.queryByRole("button", { name: /Replace/ })).toBeNull();
  });

  it("with nothing saved, is a password box with a placeholder and no Replace, Clear or Cancel", () => {
    draw({ stored: false });
    const box = screen.getByLabelText("API key");
    expect(box).toHaveAttribute("type", "password");
    expect(box).toHaveAttribute("placeholder", "Not set");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an error under the box and sets it invalid, and turns every button off while saving", () => {
    draw({ error: "This value is not valid.", disabled: true });
    expect(screen.getByText("This value is not valid.")).toBeVisible();
    expect(screen.getByLabelText("API key")).toBeInvalid();
    expect(screen.getByRole("button", { name: "Replace API key" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear API key" })).toBeDisabled();
  });
});

function row(id: string, change: Partial<CrmRow> = {}): CrmRow {
  return {
    id,
    first: "X-Source",
    second: "findprop",
    removeLabel: `Remove header ${id}`,
    ...change,
  };
}

describe("CrmRowsEditor: headers, body mapping and project codes (S7-T09)", () => {
  const draw = (extra: Partial<React.ComponentProps<typeof CrmRowsEditor>> = {}) => {
    const onChange = vi.fn();
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    renderWithMessages(
      <CrmRowsEditor
        heading="Headers"
        rows={[row("h1")]}
        firstLabel="Header name"
        secondLabel="Header value"
        onChange={onChange}
        onAdd={onAdd}
        onRemove={onRemove}
        addLabel="Add header"
        empty="No headers."
        {...extra}
      />,
    );
    return { onChange, onAdd, onRemove };
  };

  it("is a group named by its heading, with a note after the heading", () => {
    draw({ note: "(use {{field_key}} from the form)" });
    const group = screen.getByRole("group", { name: /^Headers/ });
    expect(group).toHaveTextContent("(use {{field_key}} from the form)");
  });

  it("has both boxes of each row named for a screen reader, filled in", () => {
    draw();
    expect(screen.getByLabelText("Header name")).toHaveValue("X-Source");
    expect(screen.getByLabelText("Header value")).toHaveValue("findprop");
  });

  it("tells which row and which side changed, adds, and removes by the row's id", () => {
    const { onChange, onAdd, onRemove } = draw();
    fireEvent.change(screen.getByLabelText("Header name"), { target: { value: "X-Other" } });
    expect(onChange).toHaveBeenCalledWith("h1", "first", "X-Other");
    fireEvent.change(screen.getByLabelText("Header value"), { target: { value: "v" } });
    expect(onChange).toHaveBeenCalledWith("h1", "second", "v");
    fireEvent.click(screen.getByRole("button", { name: "Add header" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove header h1" }));
    expect(onRemove).toHaveBeenCalledWith("h1");
  });

  it("says so when there are no rows, and still offers to add one", () => {
    draw({ rows: [] });
    expect(screen.getByText("No headers.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add header" })).toBeVisible();
  });

  it("makes the first box a list when it is given choices, with a first choice that says to pick", () => {
    const { onChange } = draw({
      rows: [row("c1", { first: "vista", second: "KV-01" })],
      firstLabel: "Project",
      secondLabel: "CRM code",
      firstChoices: [
        { value: "vista", label: "Kadal Vista" },
        { value: "courts", label: "Kadal Courts" },
      ],
      choose: "Choose a project",
    });
    const list = screen.getByLabelText("Project");
    expect(list.tagName).toBe("SELECT");
    expect(list).toHaveValue("vista");
    expect(within(list).getByRole("option", { name: "Choose a project" })).toBeInTheDocument();
    fireEvent.change(list, { target: { value: "courts" } });
    expect(onChange).toHaveBeenCalledWith("c1", "first", "courts");
  });

  it("shows an error under its box and sets that box invalid", () => {
    draw({
      rows: [
        row("h1", {
          firstError: "Another row already uses this name.",
          secondError: "This field is required.",
        }),
      ],
    });
    expect(screen.getByText("Another row already uses this name.")).toBeVisible();
    expect(screen.getByText("This field is required.")).toBeVisible();
    expect(screen.getByLabelText("Header name")).toBeInvalid();
    expect(screen.getByLabelText("Header value")).toBeInvalid();
  });

  it("turns every box and button off while saving", () => {
    draw({ disabled: true });
    expect(screen.getByLabelText("Header name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add header" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove header h1" })).toBeDisabled();
  });
});

const SUBMISSION_COLUMNS = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  project: "Project",
  source: "Source",
  form: "Form",
  crm: "CRM",
  actions: "Actions",
};

function submission(id: string, change: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id,
    created: "28 Oct, 11:02",
    name: "Priya Raman",
    mobile: { text: "98400 12345", href: "tel:9840012345" },
    project: "Kadal Vista",
    source: "project_page",
    form: "Enquiry form",
    crm: "Delivered",
    openLabel: "Details",
    openFor: "Priya Raman",
    onOpen: vi.fn(),
    ...change,
  };
}

describe("SubmissionsTable: the Agent column (S7-T09)", () => {
  it("has eight columns without Agent, as before", () => {
    renderWithMessages(
      <SubmissionsTable
        caption="Form submissions"
        columns={SUBMISSION_COLUMNS}
        rows={[submission("1", { agent: "Sales team" })]}
        noMobile="—"
        countText="1"
      />,
    );
    const table = screen.getByRole("table", { name: "Form submissions" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).queryByText("Sales team")).toBeNull();
  });

  it("draws the column, between Form and CRM, when it has a heading", () => {
    renderWithMessages(
      <SubmissionsTable
        caption="Form submissions"
        columns={{ ...SUBMISSION_COLUMNS, agent: "Agent" }}
        rows={[submission("1", { agent: "Sales team" }), submission("2", { agent: "—" })]}
        noMobile="—"
        countText="2"
      />,
    );
    const table = screen.getByRole("table", { name: "Form submissions" });
    const headings = within(table)
      .getAllByRole("columnheader")
      .map((heading) => heading.textContent);
    expect(headings).toHaveLength(9);
    expect(headings.indexOf("Agent")).toBe(headings.indexOf("Form") + 1);
    expect(headings.indexOf("CRM")).toBe(headings.indexOf("Agent") + 1);
    expect(within(table).getByText("Sales team")).toBeVisible();
  });
});

const DETAIL: SubmissionDetailProps = {
  details: {
    created: "28 Oct, 10:31",
    name: "Anand V",
    mobile: null,
    email: "anand@example.com",
    form: "Contact",
    project: "—",
    source: "contact_page",
  },
  noMobile: "—",
  answers: [],
  crm: { badge: "Failed" },
  failure: { title: "CRM delivery failed", text: "HTTP 502 on attempt 2." },
  words: {
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
  },
};

const WITHOUT_FAILURE: SubmissionDetailProps = {
  details: DETAIL.details,
  noMobile: DETAIL.noMobile,
  answers: DETAIL.answers,
  crm: DETAIL.crm,
  words: DETAIL.words,
};

describe("SubmissionDetail: Retry delivery now (S7-T09)", () => {
  it("has the button under a failed delivery, and runs what it is given", () => {
    const onClick = vi.fn();
    renderWithMessages(
      <SubmissionDetail {...DETAIL} retry={{ label: "Retry delivery now", onClick }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("CRM delivery failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry delivery now" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks the button busy while it retries", () => {
    renderWithMessages(
      <SubmissionDetail
        {...DETAIL}
        retry={{ label: "Retry delivery now", onClick: vi.fn(), pending: true }}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry delivery now" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("has no button when none is given, as before", () => {
    renderWithMessages(<SubmissionDetail {...DETAIL} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no button when the delivery did not fail, even if one is given", () => {
    renderWithMessages(
      <SubmissionDetail
        {...WITHOUT_FAILURE}
        retry={{ label: "Retry delivery now", onClick: vi.fn() }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
