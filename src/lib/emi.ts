/**
 * EMI maths for the AI chat's `calculate_emi` tool (ADR-128 section 5.2, task AI-P1-T05). Pure functions:
 * no input or output, no clock, no dependency. Every amount goes in and comes out as integer rupees.
 *
 * The formula is the standard reducing-balance one, with a monthly rate of `annual percent / 12 / 100`:
 *
 *     EMI = loan x rate x (1 + rate)^months / ((1 + rate)^months - 1)
 *
 * It is written as `loan x rate / (1 - (1 + rate)^-months)` and evaluated with `log1p` and `expm1`, which
 * stay exact for a very small rate. A rate of 0 is the plain split, `loan / months`.
 *
 * THE ROUNDING RULE (one rule, used everywhere in this file): a rupee amount that is not whole is rounded
 * to the nearest whole rupee, with a half rounded up (2.5 becomes 3). It is applied at exactly two points
 * and nowhere else:
 *   1. the monthly EMI (the exact EMI is rounded once);
 *   2. the down payment (`price x down payment percent`).
 * Everything else is whole-rupee arithmetic on those: the loan amount is `price - down payment`, the total
 * payable is `rounded EMI x months` (that is what the customer pays each month), and the total interest is
 * `total payable - loan amount`. So the figures add up exactly, with no hidden rupee.
 * Two guards keep a tiny loan sensible (they never matter for a real home loan): a loan above 0 has an EMI
 * of at least 1 rupee, and the total interest is never below 0 (rounding down at a zero rate can leave the
 * total payable a few rupees under the loan; the interest is then 0).
 * The last instalment of a real loan is adjusted by a lender; this maths does not model that.
 *
 * AFFORDABILITY uses the exact (unrounded) EMI as the limit, so the rounded EMI of the loan it returns can
 * never be above the budget. The price it returns is the largest whole-rupee price whose loan (price minus
 * the rounded down payment) does not exceed that loan.
 *
 * Every figure here is an example for the customer to think with, never a bank offer: the rate is always an
 * input (the example default is in `src/config/ai.ts`) and the callers label the result that way.
 *
 * Invalid input throws an `EmiInputError` with a code from a closed set. No function returns NaN or Infinity.
 * Money is shown only through `src/lib/format.ts` (see the two `format…` functions at the end).
 */
import { formatPrice, type Translate } from "./format";

const MONTHS_PER_YEAR = 12;
const PERCENT = 100;

/** A term longer than this is not a home loan, and is refused rather than computed. */
export const MAXIMUM_LOAN_YEARS = 50;

/** A rate above this is a typing mistake (for example 720 for 7.2), and is refused. */
export const MAXIMUM_ANNUAL_RATE_PERCENT = 100;

/** How far `years x 12` may be from a whole number of months before the term is refused (7.5 years is fine). */
const MONTH_TOLERANCE = 1e-9;

export type EmiErrorCode =
  | "INVALID_PRICE"
  | "INVALID_LOAN_AMOUNT"
  | "INVALID_MONTHLY_BUDGET"
  | "INVALID_YEARS"
  | "INVALID_RATE"
  | "INVALID_DOWN_PAYMENT"
  | "AMOUNT_TOO_LARGE";

/** The one error these functions throw. The `code` says which input was wrong, the message says why. */
export class EmiInputError extends Error {
  readonly code: EmiErrorCode;

  constructor(code: EmiErrorCode, message: string) {
    super(message);
    this.name = "EmiInputError";
    this.code = code;
  }
}

/** A loan amount, a yearly rate and a term. The loan is whole rupees above zero; the term is in years. */
export type LoanInput = {
  loanAmountRupees: number;
  annualRatePercent: number;
  years: number;
};

/** What a loan costs to repay. */
export type LoanRepayment = {
  loanAmountRupees: number;
  months: number;
  monthlyEmiRupees: number;
  /** The rounded EMI times the months: what is paid back to the lender in all. */
  totalPayableRupees: number;
  /** `totalPayableRupees - loanAmountRupees`. */
  totalInterestRupees: number;
};

/** A price, the share paid up front, a yearly rate and a term. */
export type PurchaseInput = {
  priceRupees: number;
  /** 0 to 100, fractions allowed. 100 means no loan. */
  downPaymentPercent: number;
  annualRatePercent: number;
  years: number;
};

/** The full picture of buying at a price: the up-front part, the loan, and what the loan costs. */
export type EmiBreakdown = LoanRepayment & {
  priceRupees: number;
  downPaymentRupees: number;
};

/** What a monthly budget supports. */
export type AffordabilityInput = {
  monthlyBudgetRupees: number;
  /** 0 up to, not including, 100. At 100 the price has no limit, so it is refused. */
  downPaymentPercent: number;
  annualRatePercent: number;
  years: number;
};

export type Affordability = {
  monthlyBudgetRupees: number;
  months: number;
  /** The largest loan whose EMI is within the budget. */
  maximumLoanRupees: number;
  /** The rounded EMI of `maximumLoanRupees`; never above the budget. */
  monthlyEmiRupees: number;
  /** The largest price whose loan, after the down payment, does not exceed `maximumLoanRupees`. */
  maximumPriceRupees: number;
  /** The down payment for `maximumPriceRupees`. */
  downPaymentRupees: number;
};

/** The one rounding rule: the nearest whole rupee, a half rounded up. Only called with values of zero or more. */
function roundRupees(value: number): number {
  return Math.round(value);
}

function requireWholeRupees(
  value: number,
  code: EmiErrorCode,
  label: string,
  minimum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new EmiInputError(
      code,
      minimum > 0
        ? `${label} must be a whole number of rupees above zero.`
        : `${label} must be a whole number of rupees.`,
    );
  }
  return value;
}

function requireRate(annualRatePercent: number): number {
  if (
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0 ||
    annualRatePercent > MAXIMUM_ANNUAL_RATE_PERCENT
  ) {
    throw new EmiInputError(
      "INVALID_RATE",
      `The yearly rate must be from 0 to ${MAXIMUM_ANNUAL_RATE_PERCENT} percent.`,
    );
  }
  return annualRatePercent;
}

/** The number of monthly instalments for a term in years; the term must be a whole number of months. */
function requireMonths(years: number): number {
  if (!Number.isFinite(years) || years <= 0 || years > MAXIMUM_LOAN_YEARS) {
    throw new EmiInputError(
      "INVALID_YEARS",
      `The term must be above 0 and at most ${MAXIMUM_LOAN_YEARS} years.`,
    );
  }
  const exactMonths = years * MONTHS_PER_YEAR;
  const months = Math.round(exactMonths);
  if (months < 1 || Math.abs(exactMonths - months) > MONTH_TOLERANCE) {
    throw new EmiInputError("INVALID_YEARS", "The term must be a whole number of months.");
  }
  return months;
}

function requireDownPaymentPercent(
  downPaymentPercent: number,
  upperBoundIncluded: boolean,
): number {
  const withinLimit = upperBoundIncluded
    ? downPaymentPercent <= PERCENT
    : downPaymentPercent < PERCENT;
  if (!Number.isFinite(downPaymentPercent) || downPaymentPercent < 0 || !withinLimit) {
    throw new EmiInputError(
      "INVALID_DOWN_PAYMENT",
      upperBoundIncluded
        ? "The down payment must be from 0 to 100 percent."
        : "The down payment must be from 0 up to, not including, 100 percent.",
    );
  }
  return downPaymentPercent;
}

function requireSafeAmount(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new EmiInputError("AMOUNT_TOO_LARGE", "The amount is too large to work out exactly.");
  }
  return value;
}

function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / MONTHS_PER_YEAR / PERCENT;
}

/** The exact (unrounded) EMI of a validated loan. A loan of 0 has an EMI of 0. */
function exactEmi(loanAmountRupees: number, annualRatePercent: number, months: number): number {
  if (loanAmountRupees === 0) return 0;
  const rate = monthlyRate(annualRatePercent);
  if (rate === 0) return loanAmountRupees / months;
  // 1 - (1 + rate)^-months, computed so a tiny rate does not lose its digits.
  const repaidShare = -Math.expm1(-months * Math.log1p(rate));
  return (loanAmountRupees * rate) / repaidShare;
}

/** The EMI as it is shown: the exact EMI rounded once, and at least 1 rupee for any loan above 0. */
function roundedEmi(loanAmountRupees: number, annualRatePercent: number, months: number): number {
  if (loanAmountRupees === 0) return 0;
  return Math.max(1, roundRupees(exactEmi(loanAmountRupees, annualRatePercent, months)));
}

function repaymentOfLoan(
  loanAmountRupees: number,
  annualRatePercent: number,
  months: number,
): LoanRepayment {
  const monthlyEmiRupees = requireSafeAmount(
    roundedEmi(loanAmountRupees, annualRatePercent, months),
  );
  const totalPayableRupees = requireSafeAmount(monthlyEmiRupees * months);
  return {
    loanAmountRupees,
    months,
    monthlyEmiRupees,
    totalPayableRupees,
    totalInterestRupees: Math.max(0, totalPayableRupees - loanAmountRupees),
  };
}

/** The down payment for a price: the rounding rule applied to `price x percent`. */
function downPaymentOf(priceRupees: number, downPaymentPercent: number): number {
  return Math.min(priceRupees, roundRupees((priceRupees * downPaymentPercent) / PERCENT));
}

/** The monthly EMI, in whole rupees, of a loan. */
export function calculateMonthlyEmi(input: LoanInput): number {
  return calculateLoanRepayment(input).monthlyEmiRupees;
}

/** The EMI, total payable and total interest of a loan. */
export function calculateLoanRepayment(input: LoanInput): LoanRepayment {
  const loanAmountRupees = requireWholeRupees(
    input.loanAmountRupees,
    "INVALID_LOAN_AMOUNT",
    "The loan amount",
    1,
  );
  const annualRatePercent = requireRate(input.annualRatePercent);
  const months = requireMonths(input.years);
  return repaymentOfLoan(loanAmountRupees, annualRatePercent, months);
}

/**
 * Buying at a price: the down payment, the loan, the EMI, the total interest and the total payable. At a
 * down payment of 100% there is no loan, and the EMI, interest and total payable are 0.
 */
export function calculateEmiBreakdown(input: PurchaseInput): EmiBreakdown {
  const priceRupees = requireWholeRupees(input.priceRupees, "INVALID_PRICE", "The price", 1);
  const downPaymentPercent = requireDownPaymentPercent(input.downPaymentPercent, true);
  const annualRatePercent = requireRate(input.annualRatePercent);
  const months = requireMonths(input.years);
  const downPaymentRupees = downPaymentOf(priceRupees, downPaymentPercent);
  return {
    priceRupees,
    downPaymentRupees,
    ...repaymentOfLoan(priceRupees - downPaymentRupees, annualRatePercent, months),
  };
}

/** The loan a price leaves after the down payment. Never goes down as the price goes up. */
function loanForPrice(priceRupees: number, downPaymentPercent: number): number {
  return priceRupees - downPaymentOf(priceRupees, downPaymentPercent);
}

/** The largest loan and price a monthly budget supports, at a down payment, rate and term. */
export function calculateAffordability(input: AffordabilityInput): Affordability {
  const monthlyBudgetRupees = requireWholeRupees(
    input.monthlyBudgetRupees,
    "INVALID_MONTHLY_BUDGET",
    "The monthly budget",
    1,
  );
  const downPaymentPercent = requireDownPaymentPercent(input.downPaymentPercent, false);
  const annualRatePercent = requireRate(input.annualRatePercent);
  const months = requireMonths(input.years);

  // Loan per rupee of EMI: the sum of the discount factors of all instalments.
  const rate = monthlyRate(annualRatePercent);
  const loanPerRupeeOfEmi = rate === 0 ? months : -Math.expm1(-months * Math.log1p(rate)) / rate;
  let maximumLoanRupees = requireSafeAmount(Math.floor(monthlyBudgetRupees * loanPerRupeeOfEmi));
  // Floating-point error may leave the loan a rupee or so too high; step down until the exact EMI fits.
  while (
    maximumLoanRupees > 0 &&
    exactEmi(maximumLoanRupees, annualRatePercent, months) > monthlyBudgetRupees
  ) {
    maximumLoanRupees -= 1;
  }

  // The largest price whose loan fits. The loan never falls as the price rises, so search for the edge.
  // The price is at most (loan + 1) / (1 - down payment share): a price over that leaves a larger loan.
  const loanShare = 1 - downPaymentPercent / PERCENT;
  let lowestPrice = 0;
  let highestPrice = requireSafeAmount(Math.ceil((maximumLoanRupees + 1) / loanShare));
  while (lowestPrice < highestPrice) {
    const middlePrice = Math.floor((lowestPrice + highestPrice + 1) / 2);
    if (loanForPrice(middlePrice, downPaymentPercent) <= maximumLoanRupees) {
      lowestPrice = middlePrice;
    } else {
      highestPrice = middlePrice - 1;
    }
  }

  return {
    monthlyBudgetRupees,
    months,
    maximumLoanRupees,
    monthlyEmiRupees: roundedEmi(maximumLoanRupees, annualRatePercent, months),
    maximumPriceRupees: lowestPrice,
    downPaymentRupees: downPaymentOf(lowestPrice, downPaymentPercent),
  };
}

export type FormattedEmiBreakdown = {
  price: string;
  downPayment: string;
  loanAmount: string;
  monthlyEmi: string;
  totalInterest: string;
  totalPayable: string;
};

export type FormattedAffordability = {
  monthlyBudget: string;
  maximumLoan: string;
  maximumPrice: string;
  downPayment: string;
};

/** The breakdown as the cards write money (₹31,494, ₹35.59 L), through `format.ts`. */
export function formatEmiBreakdown(
  translate: Translate,
  locale: string,
  breakdown: EmiBreakdown,
): FormattedEmiBreakdown {
  return {
    price: formatPrice(translate, locale, breakdown.priceRupees),
    downPayment: formatPrice(translate, locale, breakdown.downPaymentRupees),
    loanAmount: formatPrice(translate, locale, breakdown.loanAmountRupees),
    monthlyEmi: formatPrice(translate, locale, breakdown.monthlyEmiRupees),
    totalInterest: formatPrice(translate, locale, breakdown.totalInterestRupees),
    totalPayable: formatPrice(translate, locale, breakdown.totalPayableRupees),
  };
}

/** What a budget supports, as the cards write money, through `format.ts`. */
export function formatAffordability(
  translate: Translate,
  locale: string,
  affordability: Affordability,
): FormattedAffordability {
  return {
    monthlyBudget: formatPrice(translate, locale, affordability.monthlyBudgetRupees),
    maximumLoan: formatPrice(translate, locale, affordability.maximumLoanRupees),
    maximumPrice: formatPrice(translate, locale, affordability.maximumPriceRupees),
    downPayment: formatPrice(translate, locale, affordability.downPaymentRupees),
  };
}
