// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { StatusBadge } from "@/components/patterns/status-badge";
import { BuilderForm, type BuilderFormValues, type BuilderFormWords } from "../builder-form";
import { BuilderTable, type BuilderTableRow } from "../builder-table";
import { SignInAddress } from "../sign-in-address";

const COLUMNS = {
  company: "Company",
  status: "Status",
  projects: "Projects",
  leads: "Leads",
  lastSignIn: "Last sign-in",
  actions: "Actions",
};

const row = (extra: Partial<BuilderTableRow> = {}): BuilderTableRow => ({
  id: "1",
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  initials: "KH",
  status: <StatusBadge kind="builder" status="active" />,
  projects: "4",
  leads: "148",
  lastSignIn: "Today, 09:40",
  actions: <button type="button">Edit Kadal Homes</button>,
  ...extra,
});

describe("BuilderTable: the admin's list of builders (S7-T05)", () => {
  it("is a table named for a screen reader, with the six headings", () => {
    renderWithMessages(<BuilderTable caption="Builders" columns={COLUMNS} rows={[row()]} />);
    const table = screen.getByRole("table", { name: "Builders" });
    for (const heading of ["Company", "Status", "Projects", "Leads", "Last sign-in", "Actions"]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
  });

  it("shows the company with its login email, the state as a word, the numbers, the last sign-in and the actions", () => {
    renderWithMessages(<BuilderTable caption="Builders" columns={COLUMNS} rows={[row()]} />);
    const line = screen.getAllByRole("row")[1] as HTMLElement;
    expect(within(line).getByText("Kadal Homes")).toBeVisible();
    expect(within(line).getByText("sales@kadalhomes.example")).toBeVisible();
    expect(within(line).getByText("Active")).toBeVisible();
    expect(within(line).getByText("4")).toBeVisible();
    expect(within(line).getByText("148")).toBeVisible();
    expect(within(line).getByText("Today, 09:40")).toBeVisible();
    expect(within(line).getByRole("button", { name: "Edit Kadal Homes" })).toBeVisible();
  });

  it("names the three states as words, and shows an agent's badge only when it is given", () => {
    renderWithMessages(
      <BuilderTable
        caption="Builders"
        columns={COLUMNS}
        rows={[
          row({ id: "1", status: <StatusBadge kind="builder" status="invited" /> }),
          row({
            id: "2",
            name: "Nila Habitats",
            status: <StatusBadge kind="builder" status="inactive" />,
            type: <span>Agent</span>,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Invited")).toBeVisible();
    expect(screen.getByText("Inactive")).toBeVisible();
    expect(screen.getAllByText("Agent")).toHaveLength(1);
  });

  it("carries each value's word on the card layout, so a value is never bare", () => {
    renderWithMessages(<BuilderTable caption="Builders" columns={COLUMNS} rows={[row()]} />);
    const labelled = Array.from(document.querySelectorAll("[data-label]")).map((cell) =>
      cell.getAttribute("data-label"),
    );
    expect(labelled).toEqual(["Status", "Projects", "Leads", "Last sign-in"]);
  });
});

const WORDS: BuilderFormWords = {
  name: "Company name",
  email: "Login email",
  emailHint: "They sign in with Google using this email.",
  emailLockedHint: "The login email cannot be changed.",
  kind: "Type",
  kindBuilder: "Builder",
  kindAgent: "Agent",
  contactPerson: "Contact person",
  phone: "Phone",
  logoUrl: "Logo link",
  website: "Website",
  description: "About",
  optional: "(optional)",
};

const VALUES: BuilderFormValues = {
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  contactPerson: "",
  phone: "",
  logoUrl: "",
  website: "",
  description: "",
};

describe("BuilderForm: the invite and edit fields (S7-T05)", () => {
  it("labels every box, marks the two that are required and says the rest are optional", () => {
    renderWithMessages(
      <BuilderForm mode="invite" values={VALUES} onChange={vi.fn()} words={WORDS} />,
    );
    expect(screen.getByLabelText(/^Company name/)).toHaveValue("Kadal Homes");
    expect(screen.getByLabelText(/^Login email/)).toHaveValue("sales@kadalhomes.example");
    expect(screen.getByLabelText(/^Type/)).toHaveValue("builder");
    for (const label of ["Contact person", "Phone", "Logo link", "Website", "About"]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
    }
    expect(screen.getAllByText("(optional)")).toHaveLength(5);
    expect(screen.getByText(WORDS.emailHint)).toBeVisible();
  });

  it("tells the parent which field changed and to what", () => {
    const onChange = vi.fn();
    renderWithMessages(
      <BuilderForm mode="invite" values={VALUES} onChange={onChange} words={WORDS} />,
    );
    fireEvent.change(screen.getByLabelText(/^Company name/), { target: { value: "Kadal Group" } });
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: "agent" } });
    expect(onChange).toHaveBeenNthCalledWith(1, "name", "Kadal Group");
    expect(onChange).toHaveBeenNthCalledWith(2, "kind", "agent");
  });

  it("shows the error of a field next to it and marks the box as invalid", () => {
    renderWithMessages(
      <BuilderForm
        mode="invite"
        values={VALUES}
        onChange={vi.fn()}
        words={WORDS}
        errors={{ email: "This email can't be used for a builder account." }}
      />,
    );
    expect(screen.getByText("This email can't be used for a builder account.")).toBeVisible();
    expect(screen.getByLabelText(/^Login email/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Company name/)).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows the email in edit mode but does not let it be changed, and says why", () => {
    renderWithMessages(
      <BuilderForm mode="edit" values={VALUES} onChange={vi.fn()} words={WORDS} />,
    );
    const email = screen.getByLabelText(/^Login email/);
    expect(email).toHaveValue("sales@kadalhomes.example");
    expect(email).toHaveAttribute("readonly");
    expect(email).toBeDisabled();
    expect(screen.getByText(WORDS.emailLockedHint)).toBeVisible();
    expect(screen.queryByText(WORDS.emailHint)).toBeNull();
  });

  it("leaves out the Type box when asked, for the builder's own profile (S7-T03)", () => {
    renderWithMessages(
      <BuilderForm mode="edit" showKind={false} values={VALUES} onChange={vi.fn()} words={WORDS} />,
    );
    expect(screen.queryByLabelText(/^Type/)).toBeNull();
    expect(screen.getByLabelText(/^Company name/)).toBeVisible();
  });

  it("turns every box off while sending", () => {
    renderWithMessages(
      <BuilderForm mode="invite" values={VALUES} onChange={vi.fn()} words={WORDS} disabled />,
    );
    for (const control of screen.getAllByRole("textbox")) expect(control).toBeDisabled();
    expect(screen.getByLabelText(/^Type/)).toBeDisabled();
  });
});

describe("SignInAddress: the address passed on after inviting (S7-T05)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const open = () =>
    renderWithMessages(
      <SignInAddress
        label="Sign-in address"
        address="https://findsprop.com/builder/login"
        copyLabel="Copy address"
        copiedLabel="Copied"
        hint="They must use the Google account with the email above."
      />,
    );

  it("shows the address in a labelled read-only box, with its hint", () => {
    open();
    const box = screen.getByLabelText("Sign-in address");
    expect(box).toHaveValue("https://findsprop.com/builder/login");
    expect(box).toHaveAttribute("readonly");
    expect(
      screen.getByText("They must use the Google account with the email above."),
    ).toBeVisible();
  });

  it("copies the address, then says Copied on the button and to a screen reader", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeVisible());
    expect(writeText).toHaveBeenCalledWith("https://findsprop.com/builder/login");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("changes nothing when the browser refuses the clipboard, and the address stays selectable", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Copy address" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
