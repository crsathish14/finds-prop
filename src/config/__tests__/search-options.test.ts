import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import {
  BEDROOM_CHOICES,
  BUDGET_STEPS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_WORDS,
  budgetStepsFor,
  keepBudget,
  parseBedrooms,
  parseBudget,
  parsePropertyType,
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
