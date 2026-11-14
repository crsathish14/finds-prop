import "server-only";
import { z } from "zod";
import {
  ASSISTANT_BRAND_NAME,
  EMI_DEFAULT_DOWN_PAYMENT_PERCENT,
  EMI_DEFAULT_YEARS,
  EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
} from "@/config/ai";
import {
  calculateAffordability,
  calculateEmiBreakdown,
  calculateLoanRepayment,
  MAXIMUM_ANNUAL_RATE_PERCENT,
  MAXIMUM_LOAN_YEARS,
} from "@/lib/emi";
import { formatPrice } from "@/lib/format";
import type { AiChatTool, ToolContext } from "./types";

/**
 * `calculate_emi` (ADR-128 section 5.2): a home loan worked out in code, over `src/lib/emi.ts`, so the model
 * never does the sums. Two modes:
 * - `emi`: the monthly EMI, the total interest and the total payable for a price (with a down payment) or for
 *   a loan amount given directly. This covers what the ADR calls the breakdown, because the maths gives all
 *   of them from one calculation.
 * - `affordability`: the largest loan and price a monthly budget supports.
 *
 * It reads nothing and takes no person. Every result carries the same note, "an example, not a bank offer":
 * the rate is the customer's own, or the example rate in `src/config/ai.ts`, and is never a lender's rate.
 * The words of the note come from `en.json`, and every amount is written by `src/lib/format.ts`.
 */

/** Twelve digits, as the search tool reads a price. */
const AMOUNT_MAX_RUPEES = 999_999_999_999;
/** A term must be a whole number of months, as `src/lib/emi.ts` requires. */
const MONTH_TOLERANCE = 1e-9;

/** The input fields that carry a default when the customer gives none, in the order the result lists them. */
const DEFAULTED_FIELDS = ["downPaymentPercent", "annualRatePercent", "years"] as const;
type DefaultedField = (typeof DEFAULTED_FIELDS)[number];

const wholeRupees = (description: string) =>
  z
    .int()
    .nullable()
    .refine((value) => value === null || (value >= 1 && value <= AMOUNT_MAX_RUPEES))
    .describe(description);

/** Every field is required and "not given" is null (the portable subset, ADR-128 section 4.4 rule 1). */
export const calculateEmiInputSchema = z
  .object({
    mode: z
      .enum(["emi", "affordability"])
      .describe(
        "emi: the EMI, total interest and total payable of a price or a loan. affordability: the largest loan and price a monthly budget supports.",
      ),
    priceRupees: wholeRupees(
      "For emi: the price of the home in whole rupees (50 lakh is 5000000), with the down payment taken off. Give this or loanAmountRupees, not both. Null for affordability.",
    ),
    loanAmountRupees: wholeRupees(
      "For emi: the loan amount in whole rupees, when the customer gives the loan and not a price. Give this or priceRupees, not both. Null otherwise.",
    ),
    monthlyBudgetRupees: wholeRupees(
      "For affordability: the most the customer can pay each month, in whole rupees. Null for emi.",
    ),
    downPaymentPercent: z
      .number()
      .nullable()
      .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 100))
      .describe(
        `The share of the price paid up front, from 0 to 100 (below 100 for affordability), or null for the example ${EMI_DEFAULT_DOWN_PAYMENT_PERCENT}. Not used with loanAmountRupees.`,
      ),
    annualRatePercent: z
      .number()
      .nullable()
      .refine(
        (value) =>
          value === null ||
          (Number.isFinite(value) && value >= 0 && value <= MAXIMUM_ANNUAL_RATE_PERCENT),
      )
      .describe(
        `The yearly interest rate in percent, from 0 to ${MAXIMUM_ANNUAL_RATE_PERCENT}, as the customer gave it, or null for the example ${EMI_EXAMPLE_ANNUAL_RATE_PERCENT}. Never invent a lender's rate.`,
      ),
    years: z
      .number()
      .nullable()
      .refine(
        (value) =>
          value === null ||
          (Number.isFinite(value) &&
            value > 0 &&
            value <= MAXIMUM_LOAN_YEARS &&
            Math.abs(value * 12 - Math.round(value * 12)) <= MONTH_TOLERANCE),
      )
      .describe(
        `The loan term in years, a whole number of months, above 0 and at most ${MAXIMUM_LOAN_YEARS}, or null for the example ${EMI_DEFAULT_YEARS}.`,
      ),
  })
  .superRefine((input, context) => {
    const fail = (field: keyof typeof input) =>
      context.addIssue({ code: "custom", message: "does not fit the mode", path: [field] });
    if (input.mode === "emi") {
      if ((input.priceRupees === null) === (input.loanAmountRupees === null)) {
        fail("priceRupees");
        fail("loanAmountRupees");
      }
      if (input.monthlyBudgetRupees !== null) fail("monthlyBudgetRupees");
      if (input.loanAmountRupees !== null && input.downPaymentPercent !== null) {
        fail("downPaymentPercent");
      }
    } else {
      if (input.monthlyBudgetRupees === null) fail("monthlyBudgetRupees");
      if (input.priceRupees !== null) fail("priceRupees");
      if (input.loanAmountRupees !== null) fail("loanAmountRupees");
      if (input.downPaymentPercent !== null && input.downPaymentPercent >= 100) {
        fail("downPaymentPercent");
      }
    }
  });
export type CalculateEmiInput = z.infer<typeof calculateEmiInputSchema>;

/** The assumptions behind the figures, so the model can state them: the customer's own or the example. */
const assumptionsSchema = z.object({
  /** Null when the customer gave a loan amount, so there is no down payment. */
  downPaymentPercent: z.number().nullable(),
  annualRatePercent: z.number(),
  years: z.number(),
  months: z.number(),
  /** The inputs the customer did not give, which took the example value. */
  exampleValuesUsed: z.array(z.enum(DEFAULTED_FIELDS)),
});

export const calculateEmiOutputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("emi"),
    /** "This is an example, not a bank offer.": say it with the figures. */
    note: z.string().min(1),
    assumptions: assumptionsSchema,
    /** Null when the customer gave a loan amount and no price. */
    priceText: z.string().nullable(),
    downPaymentText: z.string().nullable(),
    loanAmountText: z.string().min(1),
    monthlyEmiRupees: z.number().nonnegative(),
    monthlyEmiText: z.string().min(1),
    totalInterestText: z.string().min(1),
    totalPayableText: z.string().min(1),
  }),
  z.object({
    mode: z.literal("affordability"),
    note: z.string().min(1),
    assumptions: assumptionsSchema,
    monthlyBudgetText: z.string().min(1),
    maximumLoanText: z.string().min(1),
    maximumPriceText: z.string().min(1),
    downPaymentText: z.string().min(1),
    /** The EMI of the largest loan, which is never above the budget. */
    monthlyEmiText: z.string().min(1),
  }),
]);
export type CalculateEmiOutput = z.infer<typeof calculateEmiOutputSchema>;

/** Each input the customer left out takes the example value from `src/config/ai.ts`; the result says which. */
function withDefaults(input: CalculateEmiInput, includeDownPayment: boolean) {
  const exampleValuesUsed: DefaultedField[] = [];
  const pick = (given: number | null, example: number, field: DefaultedField): number => {
    if (given !== null) return given;
    exampleValuesUsed.push(field);
    return example;
  };
  const downPaymentPercent = includeDownPayment
    ? pick(input.downPaymentPercent, EMI_DEFAULT_DOWN_PAYMENT_PERCENT, "downPaymentPercent")
    : null;
  const annualRatePercent = pick(
    input.annualRatePercent,
    EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
    "annualRatePercent",
  );
  const years = pick(input.years, EMI_DEFAULT_YEARS, "years");
  return { downPaymentPercent, annualRatePercent, years, exampleValuesUsed };
}

function run(input: CalculateEmiInput, context: ToolContext): CalculateEmiOutput {
  const money = (rupees: number) => formatPrice(context.translate, context.locale, rupees);
  const note = context.translate("ai.emiExampleNote");

  if (input.mode === "affordability") {
    const given = withDefaults(input, true);
    const downPaymentPercent = given.downPaymentPercent ?? EMI_DEFAULT_DOWN_PAYMENT_PERCENT;
    const result = calculateAffordability({
      monthlyBudgetRupees: input.monthlyBudgetRupees ?? 0,
      downPaymentPercent,
      annualRatePercent: given.annualRatePercent,
      years: given.years,
    });
    return {
      mode: "affordability",
      note,
      assumptions: {
        downPaymentPercent,
        annualRatePercent: given.annualRatePercent,
        years: given.years,
        months: result.months,
        exampleValuesUsed: given.exampleValuesUsed,
      },
      monthlyBudgetText: money(result.monthlyBudgetRupees),
      maximumLoanText: money(result.maximumLoanRupees),
      maximumPriceText: money(result.maximumPriceRupees),
      downPaymentText: money(result.downPaymentRupees),
      monthlyEmiText: money(result.monthlyEmiRupees),
    };
  }

  if (input.priceRupees !== null) {
    const given = withDefaults(input, true);
    const downPaymentPercent = given.downPaymentPercent ?? EMI_DEFAULT_DOWN_PAYMENT_PERCENT;
    const result = calculateEmiBreakdown({
      priceRupees: input.priceRupees,
      downPaymentPercent,
      annualRatePercent: given.annualRatePercent,
      years: given.years,
    });
    return {
      mode: "emi",
      note,
      assumptions: {
        downPaymentPercent,
        annualRatePercent: given.annualRatePercent,
        years: given.years,
        months: result.months,
        exampleValuesUsed: given.exampleValuesUsed,
      },
      priceText: money(result.priceRupees),
      downPaymentText: money(result.downPaymentRupees),
      loanAmountText: money(result.loanAmountRupees),
      monthlyEmiRupees: result.monthlyEmiRupees,
      monthlyEmiText: money(result.monthlyEmiRupees),
      totalInterestText: money(result.totalInterestRupees),
      totalPayableText: money(result.totalPayableRupees),
    };
  }

  const given = withDefaults(input, false);
  const result = calculateLoanRepayment({
    loanAmountRupees: input.loanAmountRupees ?? 0,
    annualRatePercent: given.annualRatePercent,
    years: given.years,
  });
  return {
    mode: "emi",
    note,
    assumptions: {
      downPaymentPercent: null,
      annualRatePercent: given.annualRatePercent,
      years: given.years,
      months: result.months,
      exampleValuesUsed: given.exampleValuesUsed,
    },
    priceText: null,
    downPaymentText: null,
    loanAmountText: money(result.loanAmountRupees),
    monthlyEmiRupees: result.monthlyEmiRupees,
    monthlyEmiText: money(result.monthlyEmiRupees),
    totalInterestText: money(result.totalInterestRupees),
    totalPayableText: money(result.totalPayableRupees),
  };
}

export const calculateEmiTool: AiChatTool<CalculateEmiInput, CalculateEmiOutput> = {
  name: "calculate_emi",
  kind: "read",
  description: [
    `Work out a home loan for a customer of ${ASSISTANT_BRAND_NAME}: use it for every EMI, loan or affordability figure, and never calculate one yourself.`,
    "mode `emi` gives the monthly EMI, total interest and total payable for a price (with a down payment) or for a loan amount. mode `affordability` gives the largest loan and price a monthly budget supports.",
    "Give null for every value the customer did not give: the result then uses an example down payment, rate and term and lists them in `assumptions.exampleValuesUsed`. State the assumptions with the figures.",
    "Every result is an example, not a bank offer: say `note` with the figures, and never present the rate as a lender's current rate.",
    "Quote the `…Text` fields exactly as written; `monthlyEmiRupees` is the same EMI in whole rupees.",
  ].join(" "),
  input: calculateEmiInputSchema,
  output: calculateEmiOutputSchema,
  async run(input, context) {
    // The input schema holds every limit the maths has, so a throw here is an amount too large to work out:
    // `runTool` turns it into the "unavailable" result.
    return { output: run(input, context), references: [] };
  },
};
