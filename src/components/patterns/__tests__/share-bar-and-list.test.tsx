// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarList } from "../bar-list";
import { ShareBar, shareParts } from "../share-bar";

const SOURCES = [
  { id: "projects", name: "Project pages", value: 412 },
  { id: "enquiries", name: "Property enquiries", value: 268 },
  { id: "forms", name: "Other forms", value: 126 },
];

describe("ShareBar (S7-T06)", () => {
  it("says each part's name, number and share in a table, so the bar adds nothing a reader would miss", () => {
    render(<ShareBar title="Leads by source" parts={SOURCES} />);
    const grid = screen.getByRole("table", { name: "Leads by source" });
    const rows = within(grid).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Project pages41251%",
      "Property enquiries26833%",
      "Other forms12616%",
    ]);
  });

  it("draws one segment for each part, in the series colours in order, with a tooltip", () => {
    const { container } = render(<ShareBar title="Leads by source" parts={SOURCES} />);
    const segments = [
      ...container.querySelectorAll("div[aria-hidden='true'] > i"),
    ] as HTMLElement[];
    expect(segments.map((segment) => segment.style.getPropertyValue("--series"))).toEqual([
      "var(--c-series-1)",
      "var(--c-series-2)",
      "var(--c-series-3)",
    ]);
    expect(segments.map((segment) => segment.title)).toEqual([
      "Project pages: 412",
      "Property enquiries: 268",
      "Other forms: 126",
    ]);
    expect(segments[0]?.style.flexGrow).toBe("412");
  });

  it("hides the bar from a screen reader", () => {
    const { container } = render(<ShareBar title="Leads by source" parts={SOURCES} />);
    expect(container.querySelector("div[aria-hidden='true']")).not.toBeNull();
  });

  it("adds a fifth part and the ones after it together as Other, in the colour kept for it", () => {
    const parts = [
      ...SOURCES,
      { id: "four", name: "Fourth", value: 50 },
      { id: "five", name: "Fifth", value: 20 },
      { id: "six", name: "Sixth", value: 5 },
    ];
    const drawn = shareParts(parts, "Other");
    expect(drawn.map((entry) => entry.part.name)).toEqual([
      "Project pages",
      "Property enquiries",
      "Other forms",
      "Fourth",
      "Other",
    ]);
    expect(drawn.at(-1)?.part.value).toBe(25);
    expect(drawn.at(-1)?.slot).toBe("other");
    expect(drawn.at(3)?.slot).toBe(4);
  });

  it("names Other in the words given", () => {
    render(
      <ShareBar
        title="Leads by source"
        otherLabel="Everything else"
        parts={[
          ...SOURCES,
          { id: "four", name: "Fourth", value: 50 },
          { id: "five", name: "Fifth", value: 20 },
        ]}
      />,
    );
    expect(screen.getByRole("rowheader", { name: "Everything else" })).toBeVisible();
  });

  it("leaves out a part with no value, and draws nothing when no part has one", () => {
    const { container, rerender } = render(
      <ShareBar
        title="Leads"
        parts={[
          { id: "a1", name: "Has", value: 3 },
          { id: "a2", name: "None", value: 0 },
        ]}
      />,
    );
    expect(screen.queryByText("None")).toBeNull();
    expect(screen.getByRole("rowheader", { name: "Has" })).toBeVisible();
    rerender(<ShareBar title="Leads" parts={[{ id: "a2", name: "None", value: 0 }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("writes numbers the Indian way", () => {
    render(<ShareBar title="Big" parts={[{ id: "big", name: "Big", value: 128400 }]} />);
    expect(screen.getByRole("cell", { name: "1,28,400" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "100%" })).toBeVisible();
  });
});

describe("BarList (S7-T06)", () => {
  const ROWS = [
    { id: "kadal", label: "Kadal Vista", value: 128 },
    { id: "arivu", label: "Arivu Heights", value: 96 },
    { id: "nila", label: "Nila Grove", value: 32 },
  ];

  it("is a list named for what it counts, each row saying its label and number in text", () => {
    render(<BarList title="Enquiries by project" rows={ROWS} />);
    const list = screen.getByRole("list", { name: "Enquiries by project" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Kadal Vista128", "Arivu Heights96", "Nila Grove32"]);
  });

  it("draws the biggest row as the full width and the others in proportion, all in one colour", () => {
    const { container } = render(<BarList title="Enquiries by project" rows={ROWS} />);
    const bars = [...container.querySelectorAll("li i")] as HTMLElement[];
    expect(bars.map((bar) => bar.style.width)).toEqual(["100%", "75%", "25%"]);
    expect(new Set(bars.map((bar) => bar.style.getPropertyValue("--series")))).toEqual(
      new Set(["var(--c-series-1)"]),
    );
  });

  it("gives each row its full label as a tooltip, for one that is cut", () => {
    render(
      <BarList
        title="Enquiries by project"
        rows={[{ id: "long", label: "Thendral Residency, the second phase", value: 5 }]}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "title",
      "Thendral Residency, the second phase: 5",
    );
  });

  it("keeps flat bars when no row has a value, and draws nothing for no rows", () => {
    const { container, rerender } = render(
      <BarList title="Enquiries by project" rows={[{ id: "none", label: "None", value: 0 }]} />,
    );
    expect(([...container.querySelectorAll("li i")] as HTMLElement[])[0]?.style.width).toBe("0%");
    rerender(<BarList title="Enquiries by project" rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("writes numbers the Indian way", () => {
    render(<BarList title="Big" rows={[{ id: "big", label: "Big", value: 128400 }]} />);
    expect(screen.getByText("1,28,400")).toBeVisible();
  });
});
