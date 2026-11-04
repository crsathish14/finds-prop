import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import {
  BEDROOM_CHOICES,
  BUDGET_STEPS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_WORDS,
  SORT_OPTIONS,
  SORT_WORDS,
  budgetStepsFor,
  budgetStepsForFilter,
  clearFilters,
  countActiveFilters,
  keepBudget,
  keepFilterBudget,
  parseBedrooms,
  parseBudget,
  parseFilterBudget,
  parseFilterIntent,
  parsePropertyType,
  parseSort,
  type FilterValues,
} from "../search-options";

describe("search options (S4-T01)", () => {
  it("offers the five kinds of property, with a word for each in en.json", () => {
    expect(PROPERTY_TYPES).toEqual(["apartment", "villa", "house", "plot", "commercial"]);
    for (const type of PROPERTY_TYPES) {
      const key = PROPERTY_TYPE_WORDS[type].replace("domain.searchCard.propertyType.", "");
      expect(
        en.domain.searchCard.propertyType[key as keyof typeof en.domain.searchCard.propertyType],
      ).toBeTruthy();
    }
  });

  it("offers bedrooms 1 to 4 only (one value, not a range)", () => {
    expect(BEDROOM_CHOICES).toEqual([1, 2, 3, 4]);
  });

  it("has the budget steps of the approved UX, smallest first", () => {
    expect(BUDGET_STEPS.buy).toEqual([
      5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000,
    ]);
    expect(BUDGET_STEPS.rent).toEqual([15_000, 25_000, 40_000, 60_000, 100_000]);
    for (const steps of [BUDGET_STEPS.buy, BUDGET_STEPS.rent]) {
      expect([...steps].sort((first, second) => first - second)).toEqual([...steps]);
    }
  });

  it("swaps the budget list with Buy and Rent", () => {
    expect(budgetStepsFor("buy")).toBe(BUDGET_STEPS.buy);
    expect(budgetStepsFor("rent")).toBe(BUDGET_STEPS.rent);
  });

  it("keeps a budget the new list has and clears one it does not", () => {
    expect(keepBudget("rent", 40_000)).toBe(40_000);
    expect(keepBudget("buy", 10_000_000)).toBe(10_000_000);
    expect(keepBudget("rent", 10_000_000)).toBeNull();
    expect(keepBudget("buy", 40_000)).toBeNull();
    expect(keepBudget("buy", null)).toBeNull();
  });

  it("reads select text, treating anything unknown as Any", () => {
    expect(parsePropertyType("villa")).toBe("villa");
    expect(parsePropertyType("")).toBeNull();
    expect(parsePropertyType("castle")).toBeNull();
    expect(parseBedrooms("3")).toBe(3);
    expect(parseBedrooms("5")).toBeNull();
    expect(parseBedrooms("")).toBeNull();
    expect(parseBudget("buy", "7500000")).toBe(7_500_000);
    expect(parseBudget("rent", "7500000")).toBeNull();
  });
});

describe("filter options (S4-T01)", () => {
  const empty: FilterValues = {
    intent: "all",
    locality: null,
    propertyType: null,
    bedrooms: null,
    maxBudget: null,
    sort: "newest",
  };

  it("shows sale amounts for All and Buy and monthly rents for Rent", () => {
    expect(budgetStepsForFilter("all")).toBe(BUDGET_STEPS.buy);
    expect(budgetStepsForFilter("buy")).toBe(BUDGET_STEPS.buy);
    expect(budgetStepsForFilter("rent")).toBe(BUDGET_STEPS.rent);
  });

  it("keeps a budget the new list has, for Looking to as well", () => {
    expect(keepFilterBudget("all", 10_000_000)).toBe(10_000_000);
    expect(keepFilterBudget("rent", 10_000_000)).toBeNull();
    expect(keepFilterBudget("rent", 25_000)).toBe(25_000);
    expect(keepFilterBudget("buy", null)).toBeNull();
  });

  it("reads select text for budget, Looking to and sort, treating unknown text as the default", () => {
    expect(parseFilterBudget("all", "7500000")).toBe(7_500_000);
    expect(parseFilterBudget("rent", "7500000")).toBeNull();
    expect(parseFilterIntent("rent")).toBe("rent");
    expect(parseFilterIntent("sell")).toBe("all");
    expect(parseSort("price_desc")).toBe("price_desc");
    expect(parseSort("cheapest")).toBe("newest");
  });

  it("has the four orders of the search function, each with a word in en.json", () => {
    expect(SORT_OPTIONS).toEqual(["newest", "price_asc", "price_desc", "area_desc"]);
    for (const option of SORT_OPTIONS) {
      const key = SORT_WORDS[option].replace("domain.filters.sort.", "");
      expect(en.domain.filters.sort[key as keyof typeof en.domain.filters.sort]).toBeTruthy();
    }
  });

  it("counts the four filters, as the UX button does, and not Looking to or the sort", () => {
    expect(countActiveFilters(empty)).toBe(0);
    expect(countActiveFilters({ ...empty, intent: "rent", sort: "price_asc" })).toBe(0);
    expect(
      countActiveFilters({
        ...empty,
        locality: "Velachery",
        propertyType: "apartment",
        bedrooms: 3,
        maxBudget: 15_000_000,
      }),
    ).toBe(4);
    expect(countActiveFilters({ ...empty, bedrooms: 1 })).toBe(1);
  });

  it("clears every filter, Looking to included, and leaves the sort alone", () => {
    expect(
      clearFilters({
        intent: "buy",
        locality: "Adyar",
        propertyType: "villa",
        bedrooms: 2,
        maxBudget: 5_000_000,
        sort: "area_desc",
      }),
    ).toEqual({ ...empty, sort: "area_desc" });
  });
});
