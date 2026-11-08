// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ResponsiveTable, type ResponsiveTableColumn } from "../responsive-table";

const COLUMNS: ResponsiveTableColumn[] = [
  { id: "name", heading: "Unit", role: "main", width: 30 },
  { id: "area", heading: "Area", align: "end", nowrap: true },
  { id: "status", heading: "Status" },
  { id: "actions", heading: "Actions", role: "actions" },
];

const ROWS = [
  {
    id: "a",
    cells: {
      name: "A-101",
      area: "1,050 sq.ft",
      status: "Available",
      actions: <button>Edit A</button>,
    },
  },
  {
    id: "b",
    cells: { name: "A-102", area: "1,450 sq.ft", status: "Sold", actions: <button>Edit B</button> },
  },
];

describe("ResponsiveTable: one list drawn as a table or as cards (S7-T01)", () => {
  it("is a table named by its caption, with a heading for each column and a row for each item", () => {
    renderWithMessages(<ResponsiveTable caption="Units" columns={COLUMNS} rows={ROWS} />);
    const table = screen.getByRole("table", { name: "Units" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("A-102")).toBeVisible();
    expect(within(table).getByText("1,450 sq.ft")).toBeVisible();
  });

  it("puts the word above each ordinary value on a card, and none above the main cell or the buttons", () => {
    renderWithMessages(<ResponsiveTable caption="Units" columns={COLUMNS} rows={ROWS} />);
    expect(document.querySelectorAll('[data-label="Area"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-label="Status"]')).toHaveLength(2);
    expect(document.querySelector('[data-label="Unit"]')).toBeNull();
    expect(document.querySelector('[data-label="Actions"]')).toBeNull();
  });

  it("hides the Actions heading as words for a screen reader, and keeps the row's buttons", () => {
    renderWithMessages(<ResponsiveTable caption="Units" columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByText("Actions")).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Edit B" })).toBeVisible();
  });

  it("gives a column its share of the table from 1024 px, and leaves the others to share the rest", () => {
    renderWithMessages(<ResponsiveTable caption="Units" columns={COLUMNS} rows={ROWS} />);
    const cols = document.querySelectorAll("col");
    expect(cols).toHaveLength(4);
    expect((cols[0] as HTMLElement).style.width).toBe("30%");
    expect((cols[1] as HTMLElement).style.width).toBe("");
  });

  it("shows only the headings when there are no rows", () => {
    renderWithMessages(<ResponsiveTable caption="Units" columns={COLUMNS} rows={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
