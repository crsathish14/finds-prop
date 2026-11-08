// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { UnitsManager, type UnitRow, type UnitsManagerProps } from "../units-manager";

const COLUMNS = {
  unit: "Unit",
  floor: "Floor",
  bhk: "BHK",
  area: "Area",
  facing: "Facing",
  price: "Price",
  status: "Status",
  actions: "Actions",
};

function row(number: string, extra: Partial<UnitRow> = {}): UnitRow {
  return {
    id: number,
    unitNumber: number,
    floor: "1",
    bhk: "2",
    area: "1,050 sq.ft",
    facing: "East",
    price: "₹78 L",
    status: <span>Available</span>,
    editLabel: "Edit",
    editFor: `unit ${number}`,
    onEdit: vi.fn(),
    deleteLabel: `Delete unit ${number}`,
    onDelete: vi.fn(),
    ...extra,
  };
}

function manager(extra: Partial<UnitsManagerProps> = {}) {
  const props: UnitsManagerProps = {
    title: "Units",
    intro: "Manage the units in your projects.",
    addLabel: "Add unit",
    onAdd: vi.fn(),
    project: {
      label: "Project",
      options: [
        { value: "vista", label: "Kadal Vista" },
        { value: "courts", label: "Kadal Courts" },
      ],
      value: "vista",
      onChange: vi.fn(),
    },
    search: {
      value: "",
      onChange: vi.fn(),
      label: "Search units",
      placeholder: "Search unit number",
    },
    states: {
      label: "Filter by state",
      options: [
        { value: "all", label: "All" },
        { value: "available", label: "Available" },
      ],
      value: "all",
      onChange: vi.fn(),
    },
    columns: COLUMNS,
    caption: "Units",
    rows: [row("A-101"), row("A-102")],
    countText: "2 of 320 units",
    note: "Units can't be moved to another project.",
    empty: {
      title: "No units in this project yet",
      text: "Add units so buyers can see what is available.",
    },
    ...extra,
  };
  renderWithMessages(<UnitsManager {...props} />);
  return props;
}

describe("UnitsManager: the units of a project (S7-T01)", () => {
  it("shows the heading, Add unit, the table, the count and the note under it", () => {
    manager();
    expect(screen.getByRole("heading", { level: 1, name: "Units" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Units" })).toBeVisible();
    expect(screen.getByText("A-102")).toBeVisible();
    expect(screen.getByText("2 of 320 units")).toBeVisible();
    expect(screen.getByText("Units can't be moved to another project.")).toBeVisible();
  });

  it("asks the page to add a unit", () => {
    const props = manager();
    fireEvent.click(screen.getByRole("button", { name: "Add unit" }));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it("tells the page the chosen project, the typed search and the chosen state", () => {
    const props = manager();
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "courts" } });
    expect(props.project.onChange).toHaveBeenCalledWith("courts");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search units" }), {
      target: { value: "A-2" },
    });
    expect(props.search.onChange).toHaveBeenCalledWith("A-2");
    const group = screen.getByRole("group", { name: "Filter by state" });
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(group).getByRole("button", { name: "Available" }));
    expect(props.states.onChange).toHaveBeenCalledWith("available");
  });

  it("names Edit by its word and the unit, and Delete by its whole name, and runs each", () => {
    const first = row("A-101");
    manager({ rows: [first] });
    fireEvent.click(screen.getByRole("button", { name: "Edit unit A-101" }));
    expect(first.onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete unit A-101" }));
    expect(first.onDelete).toHaveBeenCalledTimes(1);
  });

  it("turns both buttons off for a unit that is being deleted", () => {
    manager({ rows: [row("A-101", { pending: true })] });
    expect(screen.getByRole("button", { name: "Edit unit A-101" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete unit A-101" })).toBeDisabled();
  });

  it("shows the empty page with Add unit instead of a table, and no line under it", () => {
    const props = manager({ rows: [] });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "No units in this project yet" })).toBeVisible();
    expect(screen.queryByText("Units can't be moved to another project.")).toBeNull();
    const buttons = screen.getAllByRole("button", { name: "Add unit" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });
});
