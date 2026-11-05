// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ActiveFilters, LabelFilter, ResultsBar } from "../results-bar";
import {
  ResultsEmpty,
  ResultsError,
  ResultsGrid,
  ResultsLoadMore,
  ResultsSkeleton,
} from "../results-list";

function bar(overrides: Partial<Parameters<typeof ResultsBar>[0]> = {}) {
  const onSortChange = vi.fn();
  const onViewChange = vi.fn();
  renderWithMessages(
    <ResultsBar
      sort="newest"
      onSortChange={onSortChange}
      view="grid"
      onViewChange={onViewChange}
      {...overrides}
    />,
  );
  return { onSortChange, onViewChange };
}

describe("ResultsBar: sort and view (S4-T04)", () => {
  it("offers the four sort orders in a select named Sort by", async () => {
    const { onSortChange } = bar();
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Newest", "Price: low to high", "Price: high to low", "Largest first"]);
    await userEvent.selectOptions(select, "price_desc");
    expect(onSortChange).toHaveBeenCalledWith("price_desc");
  });

  it("names the grid and list buttons and reports the choice", async () => {
    const { onViewChange } = bar();
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Grid view" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "List view" }));
    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("draws the filters button and the rows under the bar when it is given them", () => {
    bar({ filters: <button type="button">Filters</button>, children: <p>Row under the bar</p> });
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByText("Row under the bar")).toBeInTheDocument();
  });
});

describe("ActiveFilters: what is applied (S4-T04)", () => {
  const filters = [
    { id: "locality", label: "Velachery" },
    { id: "bhk", label: "3 BHK" },
  ];

  it("draws one chip per filter with a remove button that names it", async () => {
    const onRemove = vi.fn();
    renderWithMessages(
      <ActiveFilters filters={filters} onRemove={onRemove} onClearAll={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: "Active filters" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: 3 BHK" }));
    expect(onRemove).toHaveBeenCalledWith("bhk");
  });

  it("clears everything from the Clear all button", async () => {
    const onClearAll = vi.fn();
    renderWithMessages(
      <ActiveFilters filters={filters} onRemove={vi.fn()} onClearAll={onClearAll} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("draws nothing when no filter is applied", () => {
    const view = renderWithMessages(
      <ActiveFilters filters={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(view.container).toBeEmptyDOMElement();
  });
});

describe("LabelFilter: Featured, Prime, Budget (S4-T04)", () => {
  it("marks the chosen label and reports a new choice", async () => {
    const onChange = vi.fn();
    renderWithMessages(<LabelFilter value="all" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Quick label filter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prime" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Prime" }));
    expect(onChange).toHaveBeenCalledWith("prime");
  });
});

describe("Results body: grid, loading, more, empty, error (S4-T04)", () => {
  it("lays the children out as a grid or as a list", () => {
    const { rerender } = renderWithMessages(
      <ResultsGrid view="grid">
        <p>One</p>
      </ResultsGrid>,
    );
    expect(document.querySelector("[data-slot=results-grid]")).toHaveClass("@xl:grid-cols-2");
    rerender(
      <ResultsGrid view="list">
        <p>One</p>
      </ResultsGrid>,
    );
    expect(document.querySelector("[data-slot=results-grid]")).not.toHaveClass("@xl:grid-cols-2");
  });

  it("shows six loading cards by default, named and busy", () => {
    renderWithMessages(<ResultsSkeleton view="grid" />);
    const block = screen.getByRole("status", { name: "Loading homes" });
    expect(block).toHaveAttribute("aria-busy", "true");
    expect(block.querySelectorAll("[data-slot=property-card-skeleton]")).toHaveLength(6);
  });

  it("says how many are shown and asks for more", async () => {
    const onShowMore = vi.fn();
    renderWithMessages(<ResultsLoadMore shown={12} total={48} onShowMore={onShowMore} />);
    expect(screen.getAllByText("Showing 12 of 48 homes").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Show more homes" }));
    expect(onShowMore).toHaveBeenCalledOnce();
  });

  it("uses the singular for one home and draws no button when all are shown", () => {
    renderWithMessages(<ResultsLoadMore shown={1} total={1} onShowMore={vi.fn()} />);
    expect(screen.getAllByText("Showing 1 of 1 home").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("becomes Refine your search at the limit and calls onRefine, not onShowMore", async () => {
    const onShowMore = vi.fn();
    const onRefine = vi.fn();
    renderWithMessages(
      <ResultsLoadMore
        shown={120}
        total={300}
        atLimit
        onShowMore={onShowMore}
        onRefine={onRefine}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Refine your search" }));
    expect(onRefine).toHaveBeenCalledOnce();
    expect(onShowMore).not.toHaveBeenCalled();
  });

  it("explains an empty result and offers to clear the filters", async () => {
    const onClearAll = vi.fn();
    renderWithMessages(<ResultsEmpty onClearAll={onClearAll} />);
    expect(screen.getByRole("heading", { name: "No homes match your filters" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Describe it in words/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("draws the AI link only when it is given an address", () => {
    renderWithMessages(<ResultsEmpty onClearAll={vi.fn()} describeHref="/ai-search" />);
    expect(screen.getByRole("link", { name: /Describe it in words/ })).toHaveAttribute(
      "href",
      "/ai-search",
    );
  });

  it("says the load failed as an alert and retries", async () => {
    const onRetry = vi.fn();
    renderWithMessages(<ResultsError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load homes just now");
    expect(screen.getByRole("alert")).toHaveTextContent("Your filters are saved.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
