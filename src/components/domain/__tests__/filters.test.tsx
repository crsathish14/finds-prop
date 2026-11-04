// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { clearFilters, type FilterValues } from "@/config/search-options";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { FilterRail, FilterSheet } from "../filters";

const words = en.domain.filters;
const card = en.domain.searchCard;

const LOCALITIES = ["Adyar", "Velachery", "Porur"];
const ALL_LOCALITIES = "All of Chennai";

const EMPTY: FilterValues = {
  intent: "all",
  locality: null,
  propertyType: null,
  bedrooms: null,
  maxBudget: null,
  sort: "newest",
};

const FILLED: FilterValues = {
  intent: "buy",
  locality: "Velachery",
  propertyType: "apartment",
  bedrooms: 3,
  maxBudget: 1_50_00_000,
  sort: "newest",
};

function optionTexts(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

function renderRail(values: FilterValues, onChange = vi.fn()) {
  renderWithMessages(
    <FilterRail
      values={values}
      onChange={onChange}
      localities={LOCALITIES}
      allLocalitiesLabel={ALL_LOCALITIES}
    />,
  );
  return onChange;
}

const locality = () => screen.getByRole("combobox", { name: card.locality.label });
const typeSelect = () => screen.getByRole("combobox", { name: card.propertyType.label });
const budgetSelect = () => screen.getByRole("combobox", { name: card.budget.label });

describe("FilterRail: the filter panel on a wide screen (S4-T01)", () => {
  it("is a landmark named by its heading, holding the five fields in the UX order", () => {
    renderRail(EMPTY);
    const rail = screen.getByRole("complementary", { name: words.title });
    expect(within(rail).getByRole("heading", { level: 2, name: words.title })).toBeInTheDocument();
    expect(within(rail).getByRole("radiogroup", { name: card.intentLabel })).toBeInTheDocument();
    expect(locality()).toBeInTheDocument();
    expect(typeSelect()).toBeInTheDocument();
    expect(within(rail).getByRole("group", { name: words.bedrooms })).toBeInTheDocument();
    expect(budgetSelect()).toBeInTheDocument();
    // Sort is in the sheet, not in the rail.
    expect(screen.queryByRole("combobox", { name: words.sortLabel })).not.toBeInTheDocument();
  });

  it("shows the values it is given", () => {
    renderRail(FILLED);
    expect(screen.getByRole("radio", { name: card.buy })).toBeChecked();
    expect(locality()).toHaveValue("Velachery");
    expect(typeSelect()).toHaveValue("apartment");
    expect(budgetSelect()).toHaveValue("15000000");
    expect(screen.getByRole("button", { name: "3 BHK" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers All of the city first, then the localities the page gives", () => {
    renderRail(EMPTY);
    expect(optionTexts(locality())).toEqual([ALL_LOCALITIES, ...LOCALITIES]);
  });

  it("adds a locality that is not in the list, so the box never shows a different one", () => {
    renderRail({ ...EMPTY, locality: "Sholinganallur" });
    expect(locality()).toHaveValue("Sholinganallur");
    expect(optionTexts(locality())).toEqual([ALL_LOCALITIES, "Sholinganallur", ...LOCALITIES]);
  });

  it("reports every change at once, as the whole new set", async () => {
    const onChange = renderRail(EMPTY);
    await userEvent.selectOptions(locality(), "Adyar");
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, locality: "Adyar" });
    await userEvent.selectOptions(typeSelect(), card.propertyType.villa);
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, propertyType: "villa" });
    await userEvent.selectOptions(budgetSelect(), "Up to ₹75 L");
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, maxBudget: 75_00_000 });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("goes back to All of the city when that option is chosen", async () => {
    const onChange = renderRail({ ...EMPTY, locality: "Adyar" });
    await userEvent.selectOptions(locality(), ALL_LOCALITIES);
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, locality: null });
  });

  it("takes bedrooms as one value: Any, 1, 2, 3 or 4", async () => {
    const onChange = renderRail(FILLED);
    const group = screen.getByRole("group", { name: words.bedrooms });
    expect(within(group).getAllByRole("button")).toHaveLength(5);
    expect(
      within(group)
        .getAllByRole("button")
        .filter((chip) => chip.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
    await userEvent.click(within(group).getByRole("button", { name: "2 BHK" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...FILLED, bedrooms: 2 });
    await userEvent.click(within(group).getByRole("button", { name: words.bedroomsAny }));
    expect(onChange).toHaveBeenLastCalledWith({ ...FILLED, bedrooms: null });
  });

  it("lists sale amounts for All and Buy and monthly rents for Rent", () => {
    const sale = [
      card.budget.any,
      "Up to ₹50 L",
      "Up to ₹75 L",
      "Up to ₹1 Cr",
      "Up to ₹1.5 Cr",
      "Up to ₹2 Cr",
      "Up to ₹3 Cr",
    ];
    const rent = [
      card.budget.any,
      "Up to ₹15,000",
      "Up to ₹25,000",
      "Up to ₹40,000",
      "Up to ₹60,000",
      "Up to ₹1 L",
    ];
    const all = renderWithMessages(
      <FilterRail
        values={EMPTY}
        onChange={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
      />,
    );
    expect(optionTexts(budgetSelect())).toEqual(sale);
    all.unmount();
    const buy = renderWithMessages(
      <FilterRail
        values={{ ...EMPTY, intent: "buy" }}
        onChange={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
      />,
    );
    expect(optionTexts(budgetSelect())).toEqual(sale);
    buy.unmount();
    renderWithMessages(
      <FilterRail
        values={{ ...EMPTY, intent: "rent" }}
        onChange={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
      />,
    );
    expect(optionTexts(budgetSelect())).toEqual(rent);
  });

  it("puts the budget back to Any when Looking to changes to a list that lacks the amount", async () => {
    const onChange = renderRail(FILLED);
    await userEvent.click(screen.getByRole("radio", { name: card.rent }));
    expect(onChange).toHaveBeenLastCalledWith({ ...FILLED, intent: "rent", maxBudget: null });
    await userEvent.click(screen.getByRole("radio", { name: words.all }));
    // Buy to All keeps the same sale list, so the amount stays.
    expect(onChange).toHaveBeenLastCalledWith({ ...FILLED, intent: "all" });
  });

  it("clears every filter, Looking to included, but keeps the sort order", async () => {
    const onChange = renderRail({ ...FILLED, sort: "price_asc" });
    await userEvent.click(screen.getByRole("button", { name: words.clearAll }));
    expect(onChange).toHaveBeenCalledWith({
      intent: "all",
      locality: null,
      propertyType: null,
      bedrooms: null,
      maxBudget: null,
      sort: "price_asc",
    });
  });
});

function renderSheet(
  values: FilterValues,
  props: Partial<ComponentProps<typeof FilterSheet>> = {},
) {
  const onApply = vi.fn();
  renderWithMessages(
    <FilterSheet
      values={values}
      onApply={onApply}
      localities={LOCALITIES}
      allLocalitiesLabel={ALL_LOCALITIES}
      {...props}
    />,
  );
  return onApply;
}

async function openSheet(name: string | RegExp = words.button) {
  await userEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("dialog", { name: words.title });
}

describe("FilterSheet: the Filters button and the phone bottom sheet (S4-T01)", () => {
  it("has a plain Filters button when nothing is set", () => {
    renderSheet(EMPTY);
    const button = screen.getByRole("button", { name: words.button });
    expect(button).toHaveAccessibleName("Filters");
    expect(button.textContent).toBe("Filters");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows how many filters are set, and says so in its name", () => {
    renderSheet(FILLED);
    const button = screen.getByRole("button", { name: "Filters, 4 applied" });
    expect(button.textContent).toContain("4");
    // The name comes from the content, never an aria-label, so it cannot disagree with the visible
    // words (axe: label-content-name-mismatch, WCAG 2.5.3).
    expect(button).not.toHaveAttribute("aria-label");
  });

  it("does not count Looking to or the sort order", () => {
    renderSheet({ ...EMPTY, intent: "rent", sort: "price_desc" });
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("opens a dialog named Filters with the five fields and Sort by", async () => {
    renderSheet(FILLED);
    const dialog = await openSheet("Filters, 4 applied");
    expect(within(dialog).getByRole("radiogroup", { name: card.intentLabel })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: card.locality.label })).toHaveValue(
      "Velachery",
    );
    expect(within(dialog).getByRole("group", { name: words.bedrooms })).toBeInTheDocument();
    const sort = within(dialog).getByRole("combobox", { name: words.sortLabel });
    expect(optionTexts(sort)).toEqual([
      words.sort.newest,
      words.sort.priceAsc,
      words.sort.priceDesc,
      words.sort.areaDesc,
    ]);
    expect(within(dialog).getByRole("button", { name: words.close })).toBeInTheDocument();
  });

  it("says how many homes Show will show: a number, one home, or no number yet", async () => {
    const many = renderWithMessages(
      <FilterSheet
        values={EMPTY}
        onApply={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
        resultCount={48}
      />,
    );
    let dialog = await openSheet();
    expect(within(dialog).getByRole("button", { name: "Show 48 homes" })).toBeInTheDocument();
    many.unmount();
    const one = renderWithMessages(
      <FilterSheet
        values={EMPTY}
        onApply={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
        resultCount={1}
      />,
    );
    dialog = await openSheet();
    expect(within(dialog).getByRole("button", { name: "Show 1 home" })).toBeInTheDocument();
    one.unmount();
    renderSheet(EMPTY);
    dialog = await openSheet();
    expect(within(dialog).getByRole("button", { name: words.show })).toBeInTheDocument();
  });

  it("keeps the choices until Show is pressed, then applies them all and closes", async () => {
    const onApply = renderSheet(EMPTY, { resultCount: 12 });
    const dialog = await openSheet();
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: card.locality.label }),
      "Porur",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "4 BHK" }));
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: words.sortLabel }),
      words.sort.priceAsc,
    );
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Show 12 homes" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      ...EMPTY,
      locality: "Porur",
      bedrooms: 4,
      sort: "price_asc",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("throws the choices away when the sheet is closed any other way", async () => {
    const onApply = renderSheet(FILLED);
    let dialog = await openSheet("Filters, 4 applied");
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: card.locality.label }),
      "Adyar",
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    dialog = await openSheet("Filters, 4 applied");
    expect(within(dialog).getByRole("combobox", { name: card.locality.label })).toHaveValue(
      "Velachery",
    );
  });

  it("clears every filter, keeps the sort, and stays open", async () => {
    const onApply = renderSheet({ ...FILLED, sort: "area_desc" });
    const dialog = await openSheet("Filters, 4 applied");
    await userEvent.click(within(dialog).getByRole("button", { name: words.clearAll }));
    expect(screen.getByRole("dialog", { name: words.title })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: card.locality.label })).toHaveValue("");
    expect(within(dialog).getByRole("combobox", { name: words.sortLabel })).toHaveValue(
      "area_desc",
    );
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: words.show }));
    expect(onApply).toHaveBeenCalledWith(clearFilters({ ...FILLED, sort: "area_desc" }));
  });

  it("tells the page what is being chosen, so it can count the matches", async () => {
    const onDraftChange = vi.fn();
    renderSheet(EMPTY, { onDraftChange });
    const dialog = await openSheet();
    await userEvent.click(within(dialog).getByRole("button", { name: "2 BHK" }));
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...EMPTY, bedrooms: 2 });
  });

  it("starts from what is applied each time it opens", async () => {
    const view = renderWithMessages(
      <FilterSheet
        values={EMPTY}
        onApply={vi.fn()}
        localities={LOCALITIES}
        allLocalitiesLabel={ALL_LOCALITIES}
      />,
    );
    let dialog = await openSheet();
    await userEvent.click(within(dialog).getByRole("button", { name: "3 BHK" }));
    await userEvent.keyboard("{Escape}");
    dialog = await openSheet();
    expect(within(dialog).getByRole("button", { name: "3 BHK" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    view.unmount();
  });
});
