// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard } from "../chart-card";
import { ChartTable } from "../chart-table";
import { LineChart, type LineChartSeries } from "../line-chart";

const LABELS = ["1 Oct", "2 Oct", "3 Oct", "4 Oct"];
const DETAILS = ["Thursday 1 Oct", "Friday 2 Oct", "Saturday 3 Oct", "Sunday 4 Oct"];

const SHORTLISTS: LineChartSeries = {
  id: "shortlists",
  name: "Shortlists",
  slot: 1,
  data: [52, 60, 71, 87],
};
const LEADS: LineChartSeries = { id: "leads", name: "Leads", slot: 2, data: [24, 25, 31, 33] };
const ENQUIRIES: LineChartSeries = {
  id: "enquiries",
  name: "Enquiries",
  slot: 3,
  data: [13, 14, 18, 33],
};

function chart(series: LineChartSeries[] = [SHORTLISTS, LEADS, ENQUIRIES]) {
  return render(
    <LineChart
      title="Leads, enquiries and shortlists per day"
      labels={LABELS}
      detailLabels={DETAILS}
      series={series}
    />,
  );
}

const picture = () => screen.getByRole("img", { name: "Leads, enquiries and shortlists per day" });
const tooltip = () => document.querySelector('[data-slot="line-chart-tooltip"]');

describe("LineChart (S7-T06)", () => {
  it("is one picture with a name that can be focused, and a legend naming every series", () => {
    chart();
    expect(picture()).toHaveAttribute("tabindex", "0");
    const legend = screen.getByRole("list");
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Shortlists", "Leads", "Enquiries"]);
  });

  it("has no legend for a single series, because the title names it", () => {
    chart([SHORTLISTS]);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("draws one line for each series in its own colour, pinned to its slot", () => {
    chart();
    const paths = picture().querySelectorAll("path");
    expect([...paths].map((path) => path.getAttribute("stroke"))).toEqual([
      "var(--c-series-1)",
      "var(--c-series-2)",
      "var(--c-series-3)",
    ]);
    expect([...paths].every((path) => path.getAttribute("stroke-width") === "2")).toBe(true);
  });

  it("keeps a series' colour when another series is taken away", () => {
    chart([LEADS, ENQUIRIES]);
    const paths = picture().querySelectorAll("path");
    expect([...paths].map((path) => path.getAttribute("stroke"))).toEqual([
      "var(--c-series-2)",
      "var(--c-series-3)",
    ]);
  });

  it("names each series at its end with its last number, in ink, when there is room", () => {
    chart();
    const names = [...picture().querySelectorAll("text")].map((text) => text.textContent);
    expect(names).toContain("87Shortlists");
    expect(names).toContain("33Leads");
    expect(names).toContain("33Enquiries");
  });

  it("moves two end labels that finish at the same height apart", () => {
    chart();
    const ends = [...picture().querySelectorAll("text")].filter((text) =>
      /^33(Leads|Enquiries)$/.test(text.textContent ?? ""),
    );
    expect(ends).toHaveLength(2);
    const heights = ends.map((text) => Number(text.getAttribute("y")));
    expect(Math.abs((heights[0] ?? 0) - (heights[1] ?? 0))).toBeGreaterThanOrEqual(16);
  });

  it("labels the axes: a scale of round numbers and some of the days", () => {
    chart();
    const texts = [...picture().querySelectorAll("text")].map((text) => text.textContent);
    for (const tick of ["0", "25", "50", "75", "100"]) expect(texts).toContain(tick);
    expect(texts).toContain("1 Oct");
  });

  it("shows nothing at first, then one tooltip listing every series for the point under the pointer", () => {
    chart();
    expect(tooltip()).toBeNull();
    fireEvent.pointerMove(picture(), { clientX: 0 });
    const shown = tooltip();
    expect(shown).not.toBeNull();
    expect(shown).toHaveTextContent("Thursday 1 Oct");
    expect(shown).toHaveTextContent("52Shortlists");
    expect(shown).toHaveTextContent("24Leads");
    expect(shown).toHaveTextContent("13Enquiries");
    fireEvent.pointerLeave(picture());
    expect(tooltip()).toBeNull();
  });

  it("puts a crosshair and a ringed dot on each series at the point", () => {
    chart();
    fireEvent.pointerMove(picture(), { clientX: 0 });
    expect(picture().querySelectorAll("line.stroke-line-input")).toHaveLength(1);
    // Each series has a ringed end dot (two circles) and a ringed dot at the point (two circles).
    expect(picture().querySelectorAll("circle")).toHaveLength(3 * 2 * 2);
  });

  it("moves the crosshair with the arrow keys, Home and End, and says each point in words", () => {
    chart();
    fireEvent.focus(picture());
    // On focus the last point is shown.
    expect(tooltip()).toHaveTextContent("Sunday 4 Oct");
    const spoken = () => document.querySelector("[aria-live='polite']")?.textContent;
    expect(spoken()).toBe("Sunday 4 Oct: Shortlists 87, Leads 33, Enquiries 33");

    fireEvent.keyDown(picture(), { key: "ArrowLeft" });
    expect(spoken()).toBe("Saturday 3 Oct: Shortlists 71, Leads 31, Enquiries 18");
    fireEvent.keyDown(picture(), { key: "Home" });
    expect(spoken()).toBe("Thursday 1 Oct: Shortlists 52, Leads 24, Enquiries 13");
    fireEvent.keyDown(picture(), { key: "ArrowLeft" });
    expect(tooltip()).toHaveTextContent("Thursday 1 Oct");
    fireEvent.keyDown(picture(), { key: "ArrowRight" });
    expect(tooltip()).toHaveTextContent("Friday 2 Oct");
    fireEvent.keyDown(picture(), { key: "End" });
    fireEvent.keyDown(picture(), { key: "ArrowRight" });
    expect(tooltip()).toHaveTextContent("Sunday 4 Oct");
  });

  it("hides the crosshair on Escape and when the focus leaves", () => {
    chart();
    fireEvent.focus(picture());
    fireEvent.keyDown(picture(), { key: "Escape" });
    expect(tooltip()).toBeNull();
    fireEvent.keyDown(picture(), { key: "ArrowLeft" });
    expect(tooltip()).not.toBeNull();
    fireEvent.blur(picture());
    expect(tooltip()).toBeNull();
    expect(document.querySelector("[aria-live='polite']")?.textContent).toBe("");
  });

  it("uses the day's own label in the tooltip when no longer one is given", () => {
    render(<LineChart title="Plain" labels={LABELS} series={[SHORTLISTS]} />);
    fireEvent.focus(screen.getByRole("img", { name: "Plain" }));
    expect(tooltip()).toHaveTextContent("4 Oct");
  });

  it("writes numbers in the locale given, and a unit after them", () => {
    render(
      <LineChart
        title="Big"
        labels={["a", "b"]}
        series={[{ id: "big", name: "Big", slot: 1, data: [1000, 128400] }]}
        unit="%"
      />,
    );
    fireEvent.focus(screen.getByRole("img", { name: "Big" }));
    expect(tooltip()).toHaveTextContent("1,28,400%");
  });

  it("draws a single day in the middle, and a chart of zeros on a scale of 0 and 1", () => {
    const { unmount } = render(
      <LineChart
        title="One"
        labels={["1 Oct"]}
        series={[{ id: "one", name: "One", slot: 1, data: [0] }]}
      />,
    );
    const texts = [...screen.getByRole("img", { name: "One" }).querySelectorAll("text")].map(
      (text) => text.textContent,
    );
    expect(texts).toContain("1");
    unmount();
  });

  it("draws nothing when there are no days or no series", () => {
    const { container, rerender } = render(
      <LineChart title="None" labels={[]} series={[SHORTLISTS]} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<LineChart title="None" labels={LABELS} series={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ChartTable (S7-T06)", () => {
  function table() {
    return render(
      <ChartTable
        caption="Leads, enquiries and shortlists per day"
        xName="Date"
        labels={LABELS}
        series={[SHORTLISTS, LEADS]}
      />,
    );
  }

  it("is a table with a caption, a column for each series and a row for each day", () => {
    table();
    const grid = screen.getByRole("table", { name: "Leads, enquiries and shortlists per day" });
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Date", "Shortlists", "Leads"]);
    expect(within(grid).getAllByRole("row")).toHaveLength(1 + LABELS.length);
    expect(within(grid).getByRole("rowheader", { name: "3 Oct" })).toBeVisible();
  });

  it("says the same numbers as the chart", () => {
    table();
    const row = screen.getByRole("rowheader", { name: "4 Oct" }).closest("tr") as HTMLElement;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["87", "33"]);
  });

  it("writes a unit after each number", () => {
    render(
      <ChartTable
        caption="Rates"
        xName="Day"
        labels={["a"]}
        series={[{ id: "rate", name: "Rate", data: [6] }]}
        unit="%"
      />,
    );
    expect(screen.getByRole("cell")).toHaveTextContent("6%");
  });
});

describe("ChartCard (S7-T06)", () => {
  const words = { views: "Chart view", chart: "Chart", table: "Table" };

  function card(extra: Partial<Parameters<typeof ChartCard>[0]> = {}) {
    return render(
      <ChartCard
        title="Leads, enquiries and shortlists"
        description="Per day, 1 to 30 Oct"
        table={<p>The table</p>}
        words={words}
        {...extra}
      >
        <p>The chart</p>
      </ChartCard>,
    );
  }

  it("is a section named by its heading, with what it counts under it", () => {
    card();
    const section = screen.getByRole("region", { name: "Leads, enquiries and shortlists" });
    expect(within(section).getByRole("heading", { level: 2 })).toBeVisible();
    expect(within(section).getByText("Per day, 1 to 30 Oct")).toBeVisible();
    expect(within(section).getByText("The chart")).toBeVisible();
  });

  it("can have its heading one level lower", () => {
    card({ headingLevel: 3 });
    expect(
      screen.getByRole("heading", { level: 3, name: "Leads, enquiries and shortlists" }),
    ).toBeVisible();
  });

  it("switches between the chart and its table", () => {
    card();
    const group = screen.getByRole("radiogroup", { name: "Chart view" });
    expect(within(group).getByRole("radio", { name: "Chart" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "Table" }));
    expect(screen.getByText("The table")).toBeVisible();
    expect(screen.queryByText("The chart")).toBeNull();
    fireEvent.click(within(group).getByRole("radio", { name: "Chart" }));
    expect(screen.getByText("The chart")).toBeVisible();
  });

  it("has no switch when it has no table", () => {
    card({ table: undefined });
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("says there is nothing to show, without the chart and the switch", () => {
    card({ empty: { title: "No activity in this range", text: "Try a longer date range." } });
    expect(screen.getByText("No activity in this range")).toBeVisible();
    expect(screen.getByText("Try a longer date range.")).toBeVisible();
    expect(screen.queryByText("The chart")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("shows an action at the end of the heading line, after the switch", () => {
    card({ action: <a href="#all-leads">All leads</a> });
    expect(screen.getByRole("link", { name: "All leads" })).toHaveAttribute("href", "#all-leads");
    expect(screen.getByRole("radiogroup")).toBeVisible();
  });
});
