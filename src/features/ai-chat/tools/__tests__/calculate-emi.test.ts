import { describe, expect, it, vi } from "vitest";
import {
  EMI_DEFAULT_DOWN_PAYMENT_PERCENT,
  EMI_DEFAULT_YEARS,
  EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
} from "@/config/ai";
import messages from "@/i18n/messages/en.json";
import { TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-emi (ADR-128 section 5.2): `calculate_emi` over `src/lib/emi.ts`. It reads nothing, so there is
// nothing to stand in for; the figures are checked against sums worked out by hand.

vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { calculateEmiInputSchema, calculateEmiTool } = await import("../calculate-emi");

/** Every field is required: "not given" is null. */
const NOTHING = {
  mode: "emi",
  priceRupees: null,
  loanAmountRupees: null,
  monthlyBudgetRupees: null,
  downPaymentPercent: null,
  annualRatePercent: null,
  years: null,
};

const calculate = (input: Record<string, unknown>) =>
  runTool(
    [calculateEmiTool],
    { name: "calculate_emi", input: { ...NOTHING, ...input } },
    TOOL_CONTEXT,
  );

const okOutput = async (input: Record<string, unknown>) => {
  const outcome = await calculate(input);
  if (outcome.status !== "ok") throw new Error(`the call failed: ${outcome.content}`);
  return outcome;
};

describe("UT-ai-tool-emi: the input", () => {
  it("is called calculate_emi, runs beside other calls and names no home or person", () => {
    expect(calculateEmiTool.name).toBe("calculate_emi");
    expect(calculateEmiTool.kind).toBe("read");
    const schema = toPortableJsonSchema(calculateEmiInputSchema);
    expect(Object.keys((schema.properties ?? {}) as object)).toEqual([
      "mode",
      "priceRupees",
      "loanAmountRupees",
      "monthlyBudgetRupees",
      "downPaymentPercent",
      "annualRatePercent",
      "years",
    ]);
  });

  it("says the example values in the descriptions from the config, so the two cannot drift apart", () => {
    const text = JSON.stringify(toPortableJsonSchema(calculateEmiInputSchema));
    expect(text).toContain(`example ${EMI_DEFAULT_DOWN_PAYMENT_PERCENT}`);
    expect(text).toContain(`example ${EMI_EXAMPLE_ANNUAL_RATE_PERCENT}`);
    expect(text).toContain(`example ${EMI_DEFAULT_YEARS}`);
  });

  it.each([
    ["emi with neither a price nor a loan", { mode: "emi" }, ["priceRupees", "loanAmountRupees"]],
    [
      "emi with both a price and a loan",
      { priceRupees: 5_000_000, loanAmountRupees: 4_000_000 },
      ["priceRupees", "loanAmountRupees"],
    ],
    [
      "emi with a budget",
      { priceRupees: 5_000_000, monthlyBudgetRupees: 40_000 },
      ["monthlyBudgetRupees"],
    ],
    [
      "a down payment beside a loan amount",
      { loanAmountRupees: 4_000_000, downPaymentPercent: 20 },
      ["downPaymentPercent"],
    ],
    ["affordability without a budget", { mode: "affordability" }, ["monthlyBudgetRupees"]],
    [
      "affordability with a price",
      { mode: "affordability", monthlyBudgetRupees: 40_000, priceRupees: 5_000_000 },
      ["priceRupees"],
    ],
    [
      "affordability with a full down payment, which has no limit",
      { mode: "affordability", monthlyBudgetRupees: 40_000, downPaymentPercent: 100 },
      ["downPaymentPercent"],
    ],
    ["a price of zero", { priceRupees: 0 }, ["priceRupees"]],
    ["a price with paise", { priceRupees: 5_000_000.5 }, ["priceRupees"]],
    ["a price too large to work out", { priceRupees: 1e13 }, ["priceRupees"]],
    [
      "a negative down payment",
      { priceRupees: 5_000_000, downPaymentPercent: -1 },
      ["downPaymentPercent"],
    ],
    [
      "a down payment over 100",
      { priceRupees: 5_000_000, downPaymentPercent: 101 },
      ["downPaymentPercent"],
    ],
    [
      "a rate typed as 720 for 7.2",
      { priceRupees: 5_000_000, annualRatePercent: 720 },
      ["annualRatePercent"],
    ],
    ["a negative rate", { priceRupees: 5_000_000, annualRatePercent: -1 }, ["annualRatePercent"]],
    ["a term of zero", { priceRupees: 5_000_000, years: 0 }, ["years"]],
    ["a term over the limit", { priceRupees: 5_000_000, years: 51 }, ["years"]],
    [
      "a term that is not a whole number of months",
      { priceRupees: 5_000_000, years: 7.51 },
      ["years"],
    ],
    ["an unknown mode", { priceRupees: 5_000_000, mode: "breakdown" }, ["mode"]],
  ])("refuses %s and names what to correct", async (_case, input, fields) => {
    const outcome = await calculate(input);
    expect(outcome).toMatchObject({ status: "error", code: "invalid_input" });
    if (outcome.status === "error") expect([...outcome.fields].sort()).toEqual([...fields].sort());
  });

  it("accepts a half-year term and a rate of zero", async () => {
    expect(
      (await calculate({ priceRupees: 5_000_000, years: 7.5, annualRatePercent: 0 })).status,
    ).toBe("ok");
  });
});

describe("UT-ai-tool-emi: mode emi with a price", () => {
  it("uses the example down payment, rate and term when none is given, and says so", async () => {
    const { output } = await okOutput({ priceRupees: 12_500_000 });
    // 20% of 1.25 Cr is 25 L, so the loan is 1 Cr. At 7.2% a year over 240 months the EMI is
    // 1,00,00,000 x 0.006 / (1 - 1.006^-240) = 78,734.93, shown as 78,735.
    expect(output).toEqual({
      mode: "emi",
      note: "This is an example, not a bank offer.",
      assumptions: {
        downPaymentPercent: 20,
        annualRatePercent: 7.2,
        years: 20,
        months: 240,
        exampleValuesUsed: ["downPaymentPercent", "annualRatePercent", "years"],
      },
      priceText: "₹1.25 Cr",
      downPaymentText: "₹25 L",
      loanAmountText: "₹1 Cr",
      monthlyEmiRupees: 78_735,
      monthlyEmiText: "₹78,735",
      totalInterestText: "₹88.96 L",
      totalPayableText: "₹1.89 Cr",
    });
  });

  it("uses what the customer gave and lists no example value for it", async () => {
    const { output } = await okOutput({
      priceRupees: 5_000_000,
      downPaymentPercent: 20,
      annualRatePercent: 9,
      years: 15,
    });
    // A loan of 40 L at 9% over 180 months: 4,000,000 x 0.0075 / (1 - 1.0075^-180) = 40,570.66, shown as 40,571.
    expect(output).toMatchObject({
      assumptions: {
        downPaymentPercent: 20,
        annualRatePercent: 9,
        years: 15,
        months: 180,
        exampleValuesUsed: [],
      },
      loanAmountText: "₹40 L",
      monthlyEmiRupees: 40_571,
    });
  });

  it("lists only the inputs left out", async () => {
    const { output } = await okOutput({ priceRupees: 5_000_000, annualRatePercent: 8.5 });
    expect(output).toMatchObject({
      assumptions: { exampleValuesUsed: ["downPaymentPercent", "years"] },
    });
  });

  it("gives no loan, and no EMI, when the whole price is paid up front", async () => {
    const { output } = await okOutput({ priceRupees: 5_000_000, downPaymentPercent: 100 });
    expect(output).toMatchObject({
      loanAmountText: "₹0",
      monthlyEmiRupees: 0,
      totalInterestText: "₹0",
      totalPayableText: "₹0",
    });
  });

  it("names no reference: it reads no home", async () => {
    expect((await okOutput({ priceRupees: 5_000_000 })).references).toEqual([]);
  });
});

describe("UT-ai-tool-emi: mode emi with a loan amount", () => {
  it("works out the loan as given, with no price and no down payment", async () => {
    const { output } = await okOutput({ loanAmountRupees: 10_000_000 });
    expect(output).toMatchObject({
      mode: "emi",
      assumptions: {
        downPaymentPercent: null,
        annualRatePercent: 7.2,
        years: 20,
        exampleValuesUsed: ["annualRatePercent", "years"],
      },
      priceText: null,
      downPaymentText: null,
      loanAmountText: "₹1 Cr",
      monthlyEmiRupees: 78_735,
      monthlyEmiText: "₹78,735",
    });
  });

  it("splits the total payable into the loan and the interest exactly", async () => {
    const { output } = await okOutput({ loanAmountRupees: 10_000_000 });
    // 78,735 x 240 = 1,88,96,400, so the interest is 88,96,400.
    expect(output).toMatchObject({ totalInterestText: "₹88.96 L", totalPayableText: "₹1.89 Cr" });
  });
});

describe("UT-ai-tool-emi: mode affordability", () => {
  it("works out the largest loan and price a budget supports, with the example values", async () => {
    const { output } = await okOutput({ mode: "affordability", monthlyBudgetRupees: 50_000 });
    // 50,000 a month at 7.2% over 240 months supports a loan of about 63.5 L; with 20% down that is a price
    // of about 79.38 L. The EMI of that loan is never above the budget.
    expect(output).toMatchObject({
      mode: "affordability",
      note: "This is an example, not a bank offer.",
      assumptions: {
        downPaymentPercent: 20,
        annualRatePercent: 7.2,
        years: 20,
        months: 240,
        exampleValuesUsed: ["downPaymentPercent", "annualRatePercent", "years"],
      },
      monthlyBudgetText: "₹50,000",
      maximumLoanText: "₹63.5 L",
      maximumPriceText: "₹79.38 L",
    });
  });

  it("uses what the customer gave", async () => {
    const { output } = await okOutput({
      mode: "affordability",
      monthlyBudgetRupees: 10_000,
      downPaymentPercent: 0,
      annualRatePercent: 0,
      years: 10,
    });
    // No interest: 10,000 x 120 months is 12 L, and with nothing down the price is the loan.
    expect(output).toMatchObject({
      assumptions: { exampleValuesUsed: [] },
      maximumLoanText: "₹12 L",
      maximumPriceText: "₹12 L",
      downPaymentText: "₹0",
      monthlyEmiText: "₹10,000",
    });
  });
});

describe("UT-ai-tool-emi: every result is an example", () => {
  it("carries the same note, from en.json, in every mode", async () => {
    const note = messages.ai.emiExampleNote;
    expect(note).toBe("This is an example, not a bank offer.");
    for (const input of [
      { priceRupees: 5_000_000 },
      { loanAmountRupees: 4_000_000 },
      { mode: "affordability", monthlyBudgetRupees: 40_000 },
    ]) {
      const { output } = await okOutput(input);
      expect(output).toMatchObject({ note });
    }
  });

  it("tells the model to say the note with the figures and never to call the rate a lender's", () => {
    expect(calculateEmiTool.description).toContain("an example, not a bank offer");
    expect(calculateEmiTool.description).toContain("never present the rate as a lender's");
  });
});
