import { describe, expect, it } from "vitest";
import {
  claimedFigures,
  groundedFigures,
  hasNumber,
  readFigures,
  rupeeAmountsIn,
} from "../figures";

// UT-ai-eval-figures (AI-P8-T01): the eval's own reading of figures, a second opinion beside the output check.

const TOOL_OUTPUT = {
  homes: [
    { priceRupees: 12_500_000, priceText: "₹1.25 Cr", areaSqft: 1420, bhk: 3 },
    { priceRupees: 6_450_000, priceText: "₹64.5 L", areaSqft: 1020, bhk: 2 },
  ],
  emi: { monthlyEmiText: "₹62,988", totalInterestText: "₹71.17 L" },
};

describe("UT-ai-eval-figures: claims", () => {
  it("reads rupee amounts in every way they are written, once each", () => {
    expect(claimedFigures("₹1.25 Cr")).toEqual(["12500000"]);
    expect(claimedFigures("1.25 crore")).toEqual(["12500000"]);
    expect(claimedFigures("Rs. 78 lakh")).toEqual(["7800000"]);
    expect(claimedFigures("₹85 L and ₹28,000/mo")).toEqual(["8500000", "28000"]);
    expect(claimedFigures("₹ 25k")).toEqual(["25000"]);
  });

  it("reads areas and bedroom counts", () => {
    expect(claimedFigures("1,420 sq ft and 3 BHK")).toEqual(["1420", "3"]);
    expect(claimedFigures("980 square feet, 4-BHK")).toEqual(["980", "4"]);
  });

  it("reads Tamil digits and Tamil units", () => {
    expect(claimedFigures("₹௧௨ லட்சம்")).toEqual(["1200000"]);
  });

  it("does not take a term, a count or a year for a claim", () => {
    expect(claimedFigures("over 20 years, 2 homes, in 2028")).toEqual([]);
  });
});

describe("UT-ai-eval-figures: grounding", () => {
  it("holds the numbers of the tool results, and the rupees a tool wrote as text", () => {
    const known = groundedFigures([TOOL_OUTPUT], []);
    for (const figure of ["12500000", "1.25", "6450000", "1420", "62988", "7117000"])
      expect(known.has(figure), figure).toBe(true);
  });

  it("holds what the customer wrote, with its unit", () => {
    const known = groundedFigures([], ["homes under 70 lakh please"]);
    expect(known.has("7000000")).toBe(true);
  });

  it("counts the claims no tool and no customer words hold", () => {
    expect(readFigures("₹1.25 Cr, 1,420 sq ft, 3 BHK", [TOOL_OUTPUT], [])).toEqual({
      claims: 3,
      unsupported: 0,
    });
    expect(readFigures("₹48,50,000 and 1,800 sq ft", [TOOL_OUTPUT], [])).toEqual({
      claims: 2,
      unsupported: 2,
    });
    expect(readFigures("under ₹70 L", [], ["under 70 lakh"])).toEqual({
      claims: 1,
      unsupported: 0,
    });
  });
});

describe("UT-ai-eval-figures: expected facts", () => {
  it("finds a rupee amount however it is written, including in full digits", () => {
    expect(rupeeAmountsIn("₹1.25 Cr")).toContain(12_500_000);
    expect(rupeeAmountsIn("12500000 rupees")).toContain(12_500_000);
    expect(rupeeAmountsIn("₹1,25,00,000")).toContain(12_500_000);
  });

  it("finds a plain number with or without commas, and not part of another number", () => {
    expect(hasNumber("1,420 sq ft", 1420)).toBe(true);
    expect(hasNumber("1420 sq ft", 1420)).toBe(true);
    expect(hasNumber("11,420 sq ft", 1420)).toBe(false);
  });
});
