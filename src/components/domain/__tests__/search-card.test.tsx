// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SearchCard, type SearchCardProps } from "../search-card";

const words = en.domain.searchCard;

const OPTIONS = [
  { value: "velachery", label: "Velachery", hint: "Chennai" },
  { value: "velappanchavadi", label: "Velappanchavadi" },
];

const POPULAR = [
  { label: "Adyar", href: "/properties?locality=adyar" },
  { label: "Anna Nagar", href: "/properties?locality=anna-nagar" },
  { label: "OMR Sholinganallur", href: "/properties?locality=omr" },
  { label: "Porur", href: "/properties?locality=porur" },
  { label: "Guindy", href: "/properties?locality=guindy" },
];

function setup(props: Partial<SearchCardProps> = {}) {
  const onSearch = vi.fn();
  const onLocalityQueryChange = vi.fn();
  const view = renderWithMessages(
    <SearchCard
      onSearch={onSearch}
      projectsHref="/projects"
      aiSearchHref="/ai-search"
      localityOptions={OPTIONS}
      onLocalityQueryChange={onLocalityQueryChange}
      popular={POPULAR}
      quickPickHrefs={{ bedrooms: "/properties?bhk=3", budget: "/properties?label=budget" }}
      {...props}
    />,
  );
  return { onSearch, onLocalityQueryChange, ...view };
}

const locality = () => screen.getByRole("combobox", { name: words.locality.label });
const typeSelect = () => screen.getByRole("combobox", { name: words.propertyType.label });
const bedroomsSelect = () => screen.getByRole("combobox", { name: words.bedrooms.label });
const budgetSelect = () => screen.getByRole("combobox", { name: words.budget.label });

function optionTexts(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("SearchCard: the home page search box (S4-T01)", () => {
  it("is a search form with the four fields in the fixed order and a Search button", () => {
    const { container } = setup();
    expect(screen.getByRole("search", { name: words.label })).toBeInTheDocument();
    const controls = [...container.querySelectorAll("input, select")];
    expect(controls).toEqual([locality(), typeSelect(), bedroomsSelect(), budgetSelect()]);
    expect(screen.getByRole("button", { name: words.search })).toBeInTheDocument();
  });

  it("starts on Buy, and lists each kind of property and Any", () => {
    setup();
    expect(screen.getByRole("radio", { name: words.buy })).toBeChecked();
    expect(optionTexts(typeSelect())).toEqual([
      words.propertyType.any,
      words.propertyType.apartment,
      words.propertyType.villa,
      words.propertyType.house,
      words.propertyType.plot,
      words.propertyType.commercial,
    ]);
  });

  it("takes bedrooms as one value, 1 to 4 or Any", () => {
    setup();
    expect(optionTexts(bedroomsSelect())).toEqual([
      words.bedrooms.any,
      "1 BHK",
      "2 BHK",
      "3 BHK",
      "4 BHK",
    ]);
  });

  it("offers sale amounts when buying and monthly rents when renting", async () => {
    setup();
    expect(optionTexts(budgetSelect())).toEqual([
      words.budget.any,
      "Up to ₹50 L",
      "Up to ₹75 L",
      "Up to ₹1 Cr",
      "Up to ₹1.5 Cr",
      "Up to ₹2 Cr",
      "Up to ₹3 Cr",
    ]);
    await userEvent.click(screen.getByRole("radio", { name: words.rent }));
    expect(screen.getByRole("radio", { name: words.rent })).toBeChecked();
    expect(optionTexts(budgetSelect())).toEqual([
      words.budget.any,
      "Up to ₹15,000",
      "Up to ₹25,000",
      "Up to ₹40,000",
      "Up to ₹60,000",
      "Up to ₹1 L",
    ]);
  });

  it("puts the budget back to Any when Buy and Rent are switched, since the amounts differ", async () => {
    setup({ defaultValues: { maxBudget: 1_50_00_000 } });
    expect(budgetSelect()).toHaveValue("15000000");
    await userEvent.click(screen.getByRole("radio", { name: words.rent }));
    expect(budgetSelect()).toHaveValue("");
    await userEvent.selectOptions(budgetSelect(), "Up to ₹25,000");
    await userEvent.click(screen.getByRole("radio", { name: words.buy }));
    expect(budgetSelect()).toHaveValue("");
  });

  it("has New projects as a link in the tab row, not a choice", () => {
    setup();
    const link = screen.getByRole("link", { name: new RegExp(words.newProjects) });
    expect(link).toHaveAttribute("href", "/projects");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("never disables Search: an empty search is allowed and hands over empty values", async () => {
    const { onSearch } = setup();
    const search = screen.getByRole("button", { name: words.search });
    expect(search).toBeEnabled();
    await userEvent.click(search);
    expect(onSearch).toHaveBeenCalledWith({
      intent: "buy",
      locality: "",
      propertyType: null,
      bedrooms: null,
      maxBudget: null,
    });
  });

  it("hands the page what was chosen, with the locality text trimmed", async () => {
    const { onSearch } = setup();
    await userEvent.click(screen.getByRole("radio", { name: words.rent }));
    await userEvent.type(locality(), "  Adyar  ");
    await userEvent.selectOptions(typeSelect(), words.propertyType.house);
    await userEvent.selectOptions(bedroomsSelect(), "2 BHK");
    await userEvent.selectOptions(budgetSelect(), "Up to ₹40,000");
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(onSearch).toHaveBeenCalledWith({
      intent: "rent",
      locality: "Adyar",
      propertyType: "house",
      bedrooms: 2,
      maxBudget: 40_000,
    });
  });

  it("starts from the values it is given", () => {
    setup({
      defaultValues: {
        intent: "rent",
        locality: "Velachery",
        propertyType: "villa",
        bedrooms: 4,
        maxBudget: 60_000,
      },
    });
    expect(screen.getByRole("radio", { name: words.rent })).toBeChecked();
    expect(locality()).toHaveValue("Velachery");
    expect(typeSelect()).toHaveValue("villa");
    expect(bedroomsSelect()).toHaveValue("4");
    expect(budgetSelect()).toHaveValue("60000");
  });

  it("names the short-labelled selects in full for a screen reader", () => {
    setup();
    // The visible label is "Type" on a phone; the control's name is still "Property type".
    expect(typeSelect()).toHaveAccessibleName(words.propertyType.label);
    expect(budgetSelect()).toHaveAccessibleName(words.budget.label);
  });
});

describe("SearchCard: the locality box", () => {
  it("asks the page for suggestions once the visitor pauses typing", async () => {
    const { onLocalityQueryChange } = setup();
    await userEvent.type(locality(), "Vel");
    await waitFor(() => expect(onLocalityQueryChange).toHaveBeenCalledWith("Vel"), {
      timeout: 1500,
    });
  });

  it("shows the suggestions the page gives, and picking one fills the box", async () => {
    setup();
    await userEvent.type(locality(), "Vel");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);
    await userEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: /Velachery/ }),
    );
    expect(locality()).toHaveValue("Velachery");
  });

  it("searches on Enter when no suggestion is being picked", async () => {
    const { onSearch } = setup({ localityOptions: [] });
    await userEvent.type(locality(), "Adyar{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ locality: "Adyar" }));
  });

  it("uses an Enter on a highlighted suggestion to pick it and the next Enter to search", async () => {
    const { onSearch } = setup({ localityOptions: [{ value: "velachery", label: "Velachery" }] });
    await userEvent.type(locality(), "Vel{ArrowDown}{Enter}");
    expect(onSearch).not.toHaveBeenCalled();
    expect(locality()).toHaveValue("Velachery");
    await userEvent.keyboard("{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ locality: "Velachery" }));
  });

  it("has a clear button once the box has text", async () => {
    setup({ defaultValues: { locality: "Adyar" } });
    await userEvent.click(screen.getByRole("button", { name: words.locality.clear }));
    expect(locality()).toHaveValue("");
  });
});

describe("SearchCard: links and chips", () => {
  it("draws Describe it in words only when the page gives the link (AI search on)", () => {
    const on = setup();
    expect(screen.getByRole("link", { name: words.describeInWords })).toHaveAttribute(
      "href",
      "/ai-search",
    );
    on.unmount();
    setup({ aiSearchHref: undefined });
    expect(screen.queryByRole("link", { name: words.describeInWords })).not.toBeInTheDocument();
  });

  it("shows up to four Popular localities when wide and three when stacked, as links", () => {
    const wide = setup({ layout: "wide" });
    const group = screen.getByRole("group", { name: words.popular });
    expect(
      within(group)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Adyar", "Anna Nagar", "OMR Sholinganallur", "Porur"]);
    expect(within(group).getByRole("link", { name: "Adyar" })).toHaveAttribute(
      "href",
      POPULAR[0]?.href,
    );
    wide.unmount();
    setup({ layout: "stacked" });
    expect(
      within(screen.getByRole("group", { name: words.popular })).getAllByRole("link"),
    ).toHaveLength(3);
  });

  it("has the two Quick picks, each a link the page addresses", () => {
    setup();
    const group = screen.getByRole("group", { name: words.quickPicks });
    expect(within(group).getByRole("link", { name: words.quickPickBedrooms })).toHaveAttribute(
      "href",
      "/properties?bhk=3",
    );
    expect(within(group).getByRole("link", { name: words.quickPickBudget })).toHaveAttribute(
      "href",
      "/properties?label=budget",
    );
  });

  it("leaves a group out when it has nothing to show, and a quick pick with no address", () => {
    setup({ popular: [], quickPickHrefs: { bedrooms: "/properties?bhk=3" } });
    expect(screen.queryByRole("group", { name: words.popular })).not.toBeInTheDocument();
    const group = screen.getByRole("group", { name: words.quickPicks });
    expect(within(group).getAllByRole("link")).toHaveLength(1);
  });

  it("draws no chip area at all with neither Popular nor Quick picks", () => {
    setup({ popular: [], quickPickHrefs: undefined });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("records its layout for the page and the Lab", () => {
    const { container } = setup({ layout: "stacked" });
    expect(container.querySelector("[data-slot='search-card']")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
  });
});
