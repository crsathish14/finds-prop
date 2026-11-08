// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { LeadsTable, type LeadRow } from "../leads-table";

const COLUMNS = {
  date: "Date",
  project: "Project",
  type: "Type",
  name: "Name",
  phone: "Phone",
  email: "Email",
  message: "Message",
  status: "Status",
};

const OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

function lead(id: string, extra: Partial<LeadRow> = {}, onChange = vi.fn()): LeadRow {
  return {
    id,
    date: "28 Oct, 10:42",
    project: "Kadal Vista",
    type: <span>Enquiry</span>,
    name: "Arjun Menon",
    phone: { text: "98410 55512", href: "tel:9841055512" },
    email: "arjun.menon@example.com",
    message: "Is a 3 BHK on a high floor still available?",
    status: { value: "new", label: "Status for Arjun Menon", options: OPTIONS, onChange },
    ...extra,
  };
}

describe("LeadsTable: the enquiries, with the state as the only box (S7-T01)", () => {
  it("is a table with a heading for each of the eight columns and a row for each lead", () => {
    renderWithMessages(
      <LeadsTable
        caption="Project leads"
        columns={COLUMNS}
        rows={[lead("1"), lead("2", { name: "Divya Krishnan" })]}
        countText="2 leads"
      />,
    );
    const table = screen.getByRole("table", { name: "Project leads" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Divya Krishnan")).toBeVisible();
    expect(screen.getByText("2 leads")).toBeVisible();
  });

  it("makes the phone number a call link without the spaces", () => {
    renderWithMessages(
      <LeadsTable caption="c" columns={COLUMNS} rows={[lead("1")]} countText="1 lead" />,
    );
    expect(screen.getByRole("link", { name: "98410 55512" })).toHaveAttribute(
      "href",
      "tel:9841055512",
    );
  });

  it("shows what it is given for a missing email or message", () => {
    renderWithMessages(
      <LeadsTable
        caption="c"
        columns={COLUMNS}
        rows={[lead("1", { email: "—", message: "—" })]}
        countText="1 lead"
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("changes the state from the box named for the person, and tells the page", () => {
    const onChange = vi.fn();
    renderWithMessages(
      <LeadsTable caption="c" columns={COLUMNS} rows={[lead("1", {}, onChange)]} countText="1" />,
    );
    const box = screen.getByRole("combobox", { name: "Status for Arjun Menon" });
    expect(box).toHaveValue("new");
    fireEvent.change(box, { target: { value: "contacted" } });
    expect(onChange).toHaveBeenCalledWith("contacted");
  });

  it("turns the box off while the state is saving", () => {
    const base = lead("1");
    renderWithMessages(
      <LeadsTable
        caption="c"
        columns={COLUMNS}
        rows={[{ ...base, status: { ...base.status, disabled: true } }]}
        countText="1"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Status for Arjun Menon" })).toBeDisabled();
  });

  it("shows the builder's note under the list when given", () => {
    renderWithMessages(
      <LeadsTable
        caption="c"
        columns={COLUMNS}
        rows={[lead("1")]}
        countText="1 lead"
        note="You can change a lead's status. Contact details can't be edited."
      />,
    );
    expect(screen.getByText(/Contact details can't be edited/)).toBeVisible();
  });

  it("leaves the note out when there is none", () => {
    renderWithMessages(
      <LeadsTable caption="c" columns={COLUMNS} rows={[lead("1")]} countText="1 lead" />,
    );
    expect(screen.queryByText(/Contact details/)).toBeNull();
  });
});
