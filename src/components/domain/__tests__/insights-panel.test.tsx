// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { InsightsPanel, type InsightsPanelProps } from "../insights-panel";

const GROUPS = [
  {
    id: "portfolio",
    label: "Portfolio",
    tiles: [
      { id: "projects", label: "Projects", value: "4" },
      { id: "units", label: "Total units", value: "520", note: "164 sold" },
      { id: "active", label: "Active projects", value: "3" },
      { id: "available", label: "Available units", value: "301" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    tiles: [
      { id: "views", label: "Project views", value: "6,420" },
      { id: "visitors", label: "Unique visitors", value: "3,918" },
      { id: "enquiries", label: "Enquiries", value: "128" },
      { id: "leads", label: "Leads", value: "186" },
      { id: "shortlists", label: "Shortlists", value: "342" },
    ],
  },
];

function panel(extra: Partial<InsightsPanelProps> = {}) {
  const props: InsightsPanelProps = {
    title: "Insights",
    intro: "How visitors find and respond to your projects.",
    range: {
      label: "Date range",
      options: [
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
        { value: "custom", label: "Custom" },
      ],
      value: "30",
      onChange: vi.fn(),
    },
    groups: GROUPS,
    ...extra,
  };
  renderWithMessages(<InsightsPanel {...props} />);
  return props;
}

describe("InsightsPanel: the numbers of the dashboard and insights pages (S7-T01)", () => {
  it("shows the heading, the line and each group with its tiles as label then value", () => {
    panel();
    expect(screen.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
    const portfolio = screen.getByRole("region", { name: "Portfolio" });
    expect(within(portfolio).getByText("Total units")).toBeVisible();
    expect(within(portfolio).getByText("520")).toBeVisible();
    expect(within(portfolio).getByText("164 sold")).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Activity" })).getByText("6,420"),
    ).toBeVisible();
  });

  it("sets a long number smaller in a narrow area, so it stays inside its tile", () => {
    panel({
      groups: [
        {
          id: "big",
          label: "Activity",
          tiles: [
            { id: "short", label: "Leads", value: "18,600" },
            { id: "long", label: "Project views", value: "1,284,560" },
          ],
        },
      ],
    });
    expect(screen.getByText("1,284,560")).toHaveClass("@max-md:text-title");
    expect(screen.getByText("18,600")).not.toHaveClass("@max-md:text-title");
  });

  it("puts the groups one level under the title, whichever level the title has", () => {
    panel();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Portfolio", "Activity"]);
  });

  it("uses level 3 for the groups when the title is level 2", () => {
    panel({ headingLevel: "h2" });
    expect(screen.getByRole("heading", { level: 3, name: "Portfolio" })).toBeVisible();
  });

  it("has a date choice named by its label, with the chosen one on, and tells the page a change", () => {
    const props = panel();
    const group = screen.getByRole("radiogroup", { name: "Date range" });
    expect(within(group).getByRole("radio", { name: "30 days" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "7 days" }));
    expect(props.range.onChange).toHaveBeenCalledWith("7");
  });

  it("shows the two dates only while Custom is chosen", () => {
    const custom = {
      fromLabel: "From",
      toLabel: "To",
      from: "2026-10-01",
      to: "2026-10-28",
      onFromChange: vi.fn(),
      onToChange: vi.fn(),
    };
    panel({ customRange: custom });
    expect(screen.queryByLabelText("From")).toBeNull();
  });

  it("shows the two dates and tells the page when one changes", () => {
    const custom = {
      fromLabel: "From",
      toLabel: "To",
      from: "2026-10-01",
      to: "2026-10-28",
      onFromChange: vi.fn(),
      onToChange: vi.fn(),
    };
    panel({
      range: {
        label: "Date range",
        options: [{ value: "custom", label: "Custom" }],
        value: "custom",
        onChange: vi.fn(),
      },
      customRange: custom,
    });
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-30" } });
    expect(custom.onToChange).toHaveBeenCalledWith("2026-10-30");
  });

  it("shows the project box only when given, with its All choice, and tells the page the pick", () => {
    const onChange = vi.fn();
    panel({
      project: {
        label: "Project",
        allLabel: "All projects",
        options: [{ value: "vista", label: "Kadal Vista" }],
        value: "",
        onChange,
      },
    });
    const box = screen.getByRole("combobox", { name: "Project" });
    expect(within(box).getByRole("option", { name: "All projects" })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "vista" } });
    expect(onChange).toHaveBeenCalledWith("vista");
  });

  it("has no project box on the dashboard", () => {
    panel();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows the notice above the numbers and anything given for the charts below them", () => {
    panel({ notice: <p>1 project is waiting for approval</p>, children: <p>The charts</p> });
    expect(screen.getByText("1 project is waiting for approval")).toBeVisible();
    expect(screen.getByText("The charts")).toBeVisible();
  });
});
