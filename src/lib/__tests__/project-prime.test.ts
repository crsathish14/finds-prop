import { describe, expect, it } from "vitest";
import { isPrimeProject, PROJECT_PRIME_DEFAULTS, type ProjectPrimeRules } from "../project-prime";

const rules: ProjectPrimeRules = {
  ratePerSqft: 12_000,
  totalPrice: 15_000_000,
  rentPerMonth: 60_000,
  rentPerSqftMonth: 90,
};

describe("UT-project-prime: when a project is Prime (ADR-208)", () => {
  it.each([
    ["per_sqft", 12_000, true],
    ["per_sqft", 11_999, false],
    ["basic", 15_000_000, true],
    ["all_inclusive", 15_000_001, true],
    ["basic", 14_999_999, false],
    ["rent_per_month", 60_000, true],
    ["rent_per_month", 59_999, false],
    ["rent_per_sqft_month", 90, true],
    ["rent_per_sqft_month", 89, false],
  ] as const)("%s at %d is Prime: %s", (priceType, price, prime) => {
    expect(isPrimeProject(rules, { price, priceType })).toBe(prime);
  });

  it("never makes a project Prime without a price, a price type or an amount for its type", () => {
    expect(isPrimeProject(rules, { price: null, priceType: "basic" })).toBe(false);
    expect(isPrimeProject(rules, { price: 99_000_000, priceType: null })).toBe(false);
    expect(isPrimeProject(rules, { price: 99_000_000, priceType: "per_month" })).toBe(false);
    expect(
      isPrimeProject({ ...rules, totalPrice: null }, { price: 99_000_000, priceType: "basic" }),
    ).toBe(false);
  });

  it("starts with the owner's amounts: ₹1.5 crore total, ₹60,000 rent, nothing per sq ft", () => {
    expect(PROJECT_PRIME_DEFAULTS).toEqual({
      ratePerSqft: null,
      totalPrice: 15_000_000,
      rentPerMonth: 60_000,
      rentPerSqftMonth: null,
    });
    expect(isPrimeProject(PROJECT_PRIME_DEFAULTS, { price: 9_000, priceType: "per_sqft" })).toBe(
      false,
    );
  });
});
