import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import {
  EMI_DEFAULT_DOWN_PAYMENT_PERCENT,
  EMI_DEFAULT_YEARS,
  EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
} from "@/config/ai";
import {
  calculateAffordability,
  calculateEmiBreakdown,
  calculateLoanRepayment,
  calculateMonthlyEmi,
  EmiInputError,
  formatAffordability,
  formatEmiBreakdown,
  MAXIMUM_ANNUAL_RATE_PERCENT,
  MAXIMUM_LOAN_YEARS,
  type EmiErrorCode,
} from "../emi";
import type { Translate } from "../format";

const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

function codeOf(action: () => unknown): EmiErrorCode | "NO_ERROR" {
  try {
    action();
  } catch (error) {
    if (error instanceof EmiInputError) return error.code;
    throw error;
  }
  return "NO_ERROR";
}

function isWholeSafeRupees(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * An independent check that does not use the formula: pay the loan down month by month (interest first,
 * then the instalment) and report what is still owed after the last instalment.
 */
function balanceAfterRepayment(
  loanAmountRupees: number,
  annualRatePercent: number,
  months: number,
  monthlyEmiRupees: number,
): number {
  const monthlyRate = annualRatePercent / 12 / 100;
  let balance = loanAmountRupees;
  for (let month = 0; month < months; month += 1) {
    balance = balance * (1 + monthlyRate) - monthlyEmiRupees;
  }
  return balance;
}

describe("UT-emi: the EMI of a loan matches values worked out by hand", () => {
  // Each EMI is loan x r / (1 - (1 + r)^-n) with r = rate / 1200, worked out with a calculator and then
  // rounded half up. The unrounded value is written next to it.
  it.each([
    // [loan, rate, years, exact EMI, rounded EMI, total payable, total interest]
    [10_00_000, 10, 10, 13_215.07, 13_215, 15_85_800, 5_85_800],
    [25_00_000, 8.5, 20, 21_695.58, 21_696, 52_07_040, 27_07_040],
    [40_00_000, 7.2, 20, 31_493.97, 31_494, 75_58_560, 35_58_560],
    [50_00_000, 9, 30, 40_231.13, 40_231, 1_44_83_160, 94_83_160],
    [10_00_000, 7.2, 1, 86_618.97, 86_619, 10_39_428, 39_428],
  ])(
    "a loan of %i at %f%% for %i years has an EMI of about %f, shown as %i",
    (loan, rate, years, exactEmi, roundedEmi, totalPayable, totalInterest) => {
      const repayment = calculateLoanRepayment({
        loanAmountRupees: loan,
        annualRatePercent: rate,
        years,
      });
      expect(Math.abs(roundedEmi - exactEmi)).toBeLessThanOrEqual(0.5);
      expect(repayment.monthlyEmiRupees).toBe(roundedEmi);
      expect(repayment.months).toBe(years * 12);
      expect(repayment.totalPayableRupees).toBe(totalPayable);
      expect(repayment.totalInterestRupees).toBe(totalInterest);
      expect(calculateMonthlyEmi({ loanAmountRupees: loan, annualRatePercent: rate, years })).toBe(
        roundedEmi,
      );
    },
  );

  it("agrees with paying the loan down month by month (a check that does not use the formula)", () => {
    for (const [loan, rate, years] of [
      [10_00_000, 10, 10],
      [40_00_000, 7.2, 20],
      [50_00_000, 9, 30],
      [3_00_00_000, 11.5, 15],
    ] as const) {
      const repayment = calculateLoanRepayment({
        loanAmountRupees: loan,
        annualRatePercent: rate,
        years,
      });
      const monthlyRate = rate / 12 / 100;
      // The EMI is rounded by at most half a rupee a month, which grows with interest to this much at the end.
      const mostLeftOver = (0.5 * ((1 + monthlyRate) ** repayment.months - 1)) / monthlyRate;
      const left = balanceAfterRepayment(loan, rate, repayment.months, repayment.monthlyEmiRupees);
      expect(Math.abs(left)).toBeLessThanOrEqual(mostLeftOver);
    }
  });
});

describe("UT-emi: the breakdown of buying at a price", () => {
  it("splits 50 L into 10 L down, a 40 L loan, and what the loan costs (the example defaults)", () => {
    const breakdown = calculateEmiBreakdown({
      priceRupees: 50_00_000,
      downPaymentPercent: EMI_DEFAULT_DOWN_PAYMENT_PERCENT,
      annualRatePercent: EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
      years: EMI_DEFAULT_YEARS,
    });
    expect(breakdown).toEqual({
      priceRupees: 50_00_000,
      downPaymentRupees: 10_00_000,
      loanAmountRupees: 40_00_000,
      months: 240,
      monthlyEmiRupees: 31_494,
      totalPayableRupees: 75_58_560,
      totalInterestRupees: 35_58_560,
    });
  });

  it("always adds up: price = down payment + loan, interest = payable - loan, payable = EMI x months", () => {
    for (const price of [7_77_777, 38_45_000, 1_23_45_678, 9_99_99_999]) {
      for (const down of [0, 10, 12.5, 33.3, 80]) {
        const breakdown = calculateEmiBreakdown({
          priceRupees: price,
          downPaymentPercent: down,
          annualRatePercent: 8.35,
          years: 17,
        });
        expect(breakdown.downPaymentRupees + breakdown.loanAmountRupees).toBe(price);
        expect(breakdown.totalPayableRupees).toBe(breakdown.monthlyEmiRupees * 204);
        expect(breakdown.totalInterestRupees).toBe(
          breakdown.totalPayableRupees - breakdown.loanAmountRupees,
        );
      }
    }
  });

  it("with 0% down the whole price is the loan", () => {
    const breakdown = calculateEmiBreakdown({
      priceRupees: 40_00_000,
      downPaymentPercent: 0,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(breakdown.downPaymentRupees).toBe(0);
    expect(breakdown.loanAmountRupees).toBe(40_00_000);
    expect(breakdown.monthlyEmiRupees).toBe(31_494);
  });

  it("with 100% down there is no loan: EMI, interest and total payable are 0", () => {
    const breakdown = calculateEmiBreakdown({
      priceRupees: 50_00_000,
      downPaymentPercent: 100,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(breakdown).toEqual({
      priceRupees: 50_00_000,
      downPaymentRupees: 50_00_000,
      loanAmountRupees: 0,
      months: 240,
      monthlyEmiRupees: 0,
      totalPayableRupees: 0,
      totalInterestRupees: 0,
    });
  });
});

describe("UT-emi: zero rate", () => {
  it("is the loan divided by the months", () => {
    const repayment = calculateLoanRepayment({
      loanAmountRupees: 12_00_000,
      annualRatePercent: 0,
      years: 10,
    });
    expect(repayment.monthlyEmiRupees).toBe(10_000);
    expect(repayment.totalPayableRupees).toBe(12_00_000);
    expect(repayment.totalInterestRupees).toBe(0);
  });

  it("rounds a split that does not come out even (10 L over 84 months is 11,904.76, shown as 11,905)", () => {
    const repayment = calculateLoanRepayment({
      loanAmountRupees: 10_00_000,
      annualRatePercent: 0,
      years: 7,
    });
    expect(repayment.monthlyEmiRupees).toBe(11_905);
    // The rounding is paid back, so the "interest" at a zero rate is the rounding: 11,905 x 84 - 10,00,000.
    expect(repayment.totalInterestRupees).toBe(20);
  });

  it("a very small rate gives nearly the zero-rate EMI, with no loss of digits", () => {
    const zero = calculateMonthlyEmi({
      loanAmountRupees: 12_00_000,
      annualRatePercent: 0,
      years: 10,
    });
    const tiny = calculateMonthlyEmi({
      loanAmountRupees: 12_00_000,
      annualRatePercent: 1e-9,
      years: 10,
    });
    expect(tiny).toBe(zero);
  });
});

describe("UT-emi: the rounding rule (nearest rupee, a half rounded up)", () => {
  it("rounds an EMI of exactly 2.5 up to 3, and 2.33 down to 2", () => {
    expect(calculateMonthlyEmi({ loanAmountRupees: 15, annualRatePercent: 0, years: 0.5 })).toBe(3);
    expect(calculateMonthlyEmi({ loanAmountRupees: 14, annualRatePercent: 0, years: 0.5 })).toBe(2);
  });

  it("rounds a down payment of exactly 2.5 up to 3, and 2.4 down to 2", () => {
    const half = calculateEmiBreakdown({
      priceRupees: 25,
      downPaymentPercent: 10,
      annualRatePercent: 0,
      years: 1,
    });
    expect(half.downPaymentRupees).toBe(3);
    expect(half.loanAmountRupees).toBe(22);
    const below = calculateEmiBreakdown({
      priceRupees: 24,
      downPaymentPercent: 10,
      annualRatePercent: 0,
      years: 1,
    });
    expect(below.downPaymentRupees).toBe(2);
    expect(below.loanAmountRupees).toBe(22);
  });

  it("rounds the EMI once; the total payable uses the rounded EMI, not a second rounding", () => {
    const repayment = calculateLoanRepayment({
      loanAmountRupees: 40_00_000,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(repayment.totalPayableRupees).toBe(31_494 * 240);
    expect(repayment.totalPayableRupees).not.toBe(Math.round(31_493.971958560418 * 240));
  });
});

describe("UT-emi: extremes", () => {
  it("handles a very large price (1,000 crore) and stays in whole, safe rupees", () => {
    const breakdown = calculateEmiBreakdown({
      priceRupees: 1_000_000_000_000,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 30,
    });
    expect(breakdown.downPaymentRupees).toBe(200_000_000_000);
    expect(breakdown.loanAmountRupees).toBe(800_000_000_000);
    // 8e11 x 0.0060 / (1 - 1.006^-360) = 5,430,305,675.74, worked out by scaling the 1e12 loan's EMI.
    expect(breakdown.monthlyEmiRupees).toBe(5_430_305_676);
    for (const value of Object.values(breakdown)) expect(isWholeSafeRupees(value)).toBe(true);
  });

  it("handles the shortest term (1 year) and the longest usual one (30 years)", () => {
    expect(
      calculateMonthlyEmi({ loanAmountRupees: 10_00_000, annualRatePercent: 7.2, years: 1 }),
    ).toBe(86_619);
    expect(
      calculateMonthlyEmi({ loanAmountRupees: 50_00_000, annualRatePercent: 9, years: 30 }),
    ).toBe(40_231);
  });

  it("handles a single month and a term of 7.5 years (90 months)", () => {
    const oneMonth = calculateLoanRepayment({
      loanAmountRupees: 1_00_000,
      annualRatePercent: 12,
      years: 1 / 12,
    });
    expect(oneMonth.months).toBe(1);
    // One month: the loan plus one month's interest at 1%.
    expect(oneMonth.monthlyEmiRupees).toBe(1_01_000);
    expect(
      calculateLoanRepayment({ loanAmountRupees: 10_00_000, annualRatePercent: 0, years: 7.5 })
        .months,
    ).toBe(90);
  });

  it("handles the smallest loan, 1 rupee: the EMI is at least 1 rupee and the interest is never negative", () => {
    const repayment = calculateLoanRepayment({
      loanAmountRupees: 1,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(repayment.monthlyEmiRupees).toBe(1);
    expect(repayment.totalPayableRupees).toBe(240);
    expect(repayment.totalInterestRupees).toBe(239);
  });

  it("never shows a negative interest: 100 rupees over 12 months at a zero rate rounds the EMI down to 8", () => {
    const repayment = calculateLoanRepayment({
      loanAmountRupees: 100,
      annualRatePercent: 0,
      years: 1,
    });
    expect(repayment.monthlyEmiRupees).toBe(8);
    expect(repayment.totalPayableRupees).toBe(96);
    expect(repayment.totalInterestRupees).toBe(0);
  });

  it("never returns NaN, Infinity or a fraction, over a grid of prices, rates and terms", () => {
    for (const price of [1, 99, 5_00_000, 50_00_000, 1_000_000_000, 1_000_000_000_000]) {
      for (const down of [0, 20, 99.9, 100]) {
        for (const rate of [0, 1e-9, 7.2, 18, MAXIMUM_ANNUAL_RATE_PERCENT]) {
          for (const years of [1 / 12, 1, 20, 30, MAXIMUM_LOAN_YEARS]) {
            const breakdown = calculateEmiBreakdown({
              priceRupees: price,
              downPaymentPercent: down,
              annualRatePercent: rate,
              years,
            });
            for (const value of Object.values(breakdown))
              expect(isWholeSafeRupees(value)).toBe(true);
          }
        }
      }
    }
  });
});

describe("UT-emi: invalid input is refused with a typed error, never NaN or Infinity", () => {
  const goodPurchase = {
    priceRupees: 50_00_000,
    downPaymentPercent: 20,
    annualRatePercent: 7.2,
    years: 20,
  };

  it.each([0, -1, -50_00_000, Number.NaN, Number.POSITIVE_INFINITY, 12.5, 2 ** 53])(
    "refuses a price of %s",
    (price) => {
      expect(codeOf(() => calculateEmiBreakdown({ ...goodPurchase, priceRupees: price }))).toBe(
        "INVALID_PRICE",
      );
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5])(
    "refuses a loan amount of %s",
    (loan) => {
      expect(
        codeOf(() =>
          calculateMonthlyEmi({ loanAmountRupees: loan, annualRatePercent: 7.2, years: 20 }),
        ),
      ).toBe("INVALID_LOAN_AMOUNT");
    },
  );

  it.each([
    0,
    -1,
    -20,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAXIMUM_LOAN_YEARS + 1,
    0.1, // 1.2 months
    1 / 24, // half a month
  ])("refuses a term of %s years", (years) => {
    expect(codeOf(() => calculateEmiBreakdown({ ...goodPurchase, years }))).toBe("INVALID_YEARS");
    expect(
      codeOf(() =>
        calculateMonthlyEmi({ loanAmountRupees: 10_00_000, annualRatePercent: 7.2, years }),
      ),
    ).toBe("INVALID_YEARS");
  });

  it.each([-0.1, -7.2, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 720])(
    "refuses a rate of %s",
    (rate) => {
      expect(
        codeOf(() => calculateEmiBreakdown({ ...goodPurchase, annualRatePercent: rate })),
      ).toBe("INVALID_RATE");
    },
  );

  it.each([-1, -0.01, 100.01, 150, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses a down payment of %s%%",
    (down) => {
      expect(
        codeOf(() => calculateEmiBreakdown({ ...goodPurchase, downPaymentPercent: down })),
      ).toBe("INVALID_DOWN_PAYMENT");
    },
  );

  it("refuses an amount whose total cannot be held exactly", () => {
    expect(
      codeOf(() =>
        calculateEmiBreakdown({
          priceRupees: Number.MAX_SAFE_INTEGER,
          downPaymentPercent: 0,
          annualRatePercent: 12,
          years: 30,
        }),
      ),
    ).toBe("AMOUNT_TOO_LARGE");
  });

  it("refuses bad affordability input too", () => {
    const good = {
      monthlyBudgetRupees: 25_000,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 20,
    };
    expect(codeOf(() => calculateAffordability({ ...good, monthlyBudgetRupees: 0 }))).toBe(
      "INVALID_MONTHLY_BUDGET",
    );
    expect(codeOf(() => calculateAffordability({ ...good, monthlyBudgetRupees: -5 }))).toBe(
      "INVALID_MONTHLY_BUDGET",
    );
    expect(codeOf(() => calculateAffordability({ ...good, monthlyBudgetRupees: Number.NaN }))).toBe(
      "INVALID_MONTHLY_BUDGET",
    );
    expect(codeOf(() => calculateAffordability({ ...good, years: 0 }))).toBe("INVALID_YEARS");
    expect(codeOf(() => calculateAffordability({ ...good, annualRatePercent: -1 }))).toBe(
      "INVALID_RATE",
    );
    expect(codeOf(() => calculateAffordability({ ...good, downPaymentPercent: 101 }))).toBe(
      "INVALID_DOWN_PAYMENT",
    );
  });

  it("refuses affordability at a 100% down payment, where the price has no limit", () => {
    expect(
      codeOf(() =>
        calculateAffordability({
          monthlyBudgetRupees: 25_000,
          downPaymentPercent: 100,
          annualRatePercent: 7.2,
          years: 20,
        }),
      ),
    ).toBe("INVALID_DOWN_PAYMENT");
  });

  it("refuses a budget so large that the loan cannot be held exactly", () => {
    expect(
      codeOf(() =>
        calculateAffordability({
          monthlyBudgetRupees: Number.MAX_SAFE_INTEGER,
          downPaymentPercent: 20,
          annualRatePercent: 7.2,
          years: 20,
        }),
      ),
    ).toBe("AMOUNT_TOO_LARGE");
  });

  it("the error carries its code and a message, and is an Error", () => {
    try {
      calculateMonthlyEmi({ loanAmountRupees: 0, annualRatePercent: 7.2, years: 20 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EmiInputError);
      expect((error as EmiInputError).code).toBe("INVALID_LOAN_AMOUNT");
      expect((error as EmiInputError).message.length).toBeGreaterThan(0);
    }
  });
});

describe("UT-emi: affordability", () => {
  it("25,000 a month at 7.2% for 20 years supports a loan of 31,75,210, worked out by hand", () => {
    // Loan per rupee of EMI = (1 - 1.006^-240) / 0.006 = 127.0084, so 25,000 x 127.0084 = 31,75,210.8,
    // and the largest whole-rupee loan within the budget is 31,75,210.
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 25_000,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(affordability.maximumLoanRupees).toBe(31_75_210);
    expect(affordability.monthlyEmiRupees).toBe(25_000);
    // The loan is 80% of the price: 31,75,210 / 0.8 = 39,69,012.5, so the price is 39,69,012 (or 13 if the
    // rounded down payment lets the loan stay within 31,75,210): 39,69,013 x 0.2 = 7,93,802.6 -> 7,93,803,
    // a loan of 31,75,210. So 39,69,013 fits.
    expect(affordability.maximumPriceRupees).toBe(39_69_013);
    expect(affordability.downPaymentRupees).toBe(7_93_803);
  });

  it("at a zero rate the loan is the budget times the months", () => {
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 10_000,
      downPaymentPercent: 20,
      annualRatePercent: 0,
      years: 10,
    });
    expect(affordability.maximumLoanRupees).toBe(12_00_000);
    expect(affordability.monthlyEmiRupees).toBe(10_000);
    // The loan is 80% of the price, so the price is 15 L and the down payment 3 L.
    expect(affordability.maximumPriceRupees).toBe(15_00_000);
    expect(affordability.downPaymentRupees).toBe(3_00_000);
  });

  it("with 0% down the price is the loan", () => {
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 10_000,
      downPaymentPercent: 0,
      annualRatePercent: 0,
      years: 10,
    });
    expect(affordability.maximumPriceRupees).toBe(affordability.maximumLoanRupees);
    expect(affordability.downPaymentRupees).toBe(0);
  });

  it("is consistent with the EMI: the loan it returns, put back into the EMI, does not exceed the budget", () => {
    for (const budget of [1, 750, 5_000, 25_000, 1_00_000, 12_34_567, 10_000_000]) {
      for (const down of [0, 10, 20, 50, 90]) {
        for (const rate of [0, 1e-9, 6.5, 7.2, 12, 24]) {
          for (const years of [1 / 12, 1, 15, 20, 30]) {
            const affordability = calculateAffordability({
              monthlyBudgetRupees: budget,
              downPaymentPercent: down,
              annualRatePercent: rate,
              years,
            });
            const months = Math.round(years * 12);
            if (affordability.maximumLoanRupees > 0) {
              const emi = calculateMonthlyEmi({
                loanAmountRupees: affordability.maximumLoanRupees,
                annualRatePercent: rate,
                years,
              });
              expect(emi).toBe(affordability.monthlyEmiRupees);
              expect(emi).toBeLessThanOrEqual(budget);
            }
            // It is the largest: a loan a few instalments' worth bigger no longer fits.
            expect(
              calculateMonthlyEmi({
                loanAmountRupees: affordability.maximumLoanRupees + 3 * months,
                annualRatePercent: rate,
                years,
              }),
            ).toBeGreaterThan(budget);

            // The price it returns, bought at that down payment, needs a loan within the same budget.
            if (affordability.maximumPriceRupees > 0) {
              const breakdown = calculateEmiBreakdown({
                priceRupees: affordability.maximumPriceRupees,
                downPaymentPercent: down,
                annualRatePercent: rate,
                years,
              });
              expect(breakdown.monthlyEmiRupees).toBeLessThanOrEqual(budget);
              expect(breakdown.downPaymentRupees).toBe(affordability.downPaymentRupees);
            }
            // And it is the largest price: one rupee more needs a bigger loan than the budget allows.
            const next = calculateEmiBreakdown({
              priceRupees: affordability.maximumPriceRupees + 1,
              downPaymentPercent: down,
              annualRatePercent: rate,
              years,
            });
            expect(next.loanAmountRupees).toBeGreaterThan(affordability.maximumLoanRupees);
          }
        }
      }
    }
  });

  it("round-trips with the breakdown: the example 50 L home needs about 31,494 a month, which affords about 50 L back", () => {
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 31_494,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 20,
    });
    // The budget is the rounded-up EMI of a 40 L loan, so it affords at least the 40 L loan.
    expect(affordability.maximumLoanRupees).toBeGreaterThanOrEqual(40_00_000);
    expect(affordability.maximumLoanRupees).toBeLessThan(40_00_000 + 100);
  });

  it("handles a very large budget and stays in whole, safe rupees", () => {
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 1_000_000_000,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 30,
    });
    for (const value of Object.values(affordability)) expect(isWholeSafeRupees(value)).toBe(true);
    expect(affordability.monthlyEmiRupees).toBeLessThanOrEqual(1_000_000_000);
  });
});

describe("UT-emi: money is shown through format.ts", () => {
  it("writes the example breakdown the way the cards write prices", () => {
    const breakdown = calculateEmiBreakdown({
      priceRupees: 50_00_000,
      downPaymentPercent: 20,
      annualRatePercent: 7.2,
      years: 20,
    });
    expect(formatEmiBreakdown(translate, "en", breakdown)).toEqual({
      price: "₹50 L",
      downPayment: "₹10 L",
      loanAmount: "₹40 L",
      monthlyEmi: "₹31,494",
      totalInterest: "₹35.59 L",
      totalPayable: "₹75.59 L",
    });
  });

  it("writes an affordability result the same way", () => {
    const affordability = calculateAffordability({
      monthlyBudgetRupees: 10_000,
      downPaymentPercent: 20,
      annualRatePercent: 0,
      years: 10,
    });
    expect(formatAffordability(translate, "en", affordability)).toEqual({
      monthlyBudget: "₹10,000",
      maximumLoan: "₹12 L",
      maximumPrice: "₹15 L",
      downPayment: "₹3 L",
    });
  });
});
