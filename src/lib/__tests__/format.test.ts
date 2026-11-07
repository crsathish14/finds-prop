import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import {
  calendarYear,
  formatAcres,
  formatArea,
  formatDate,
  formatTime,
  formatListedAgo,
  formatMonth,
  formatPerSqft,
  formatPrice,
  formatRent,
  type Translate,
} from "../format";

const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

describe("UT-format: prices follow the approved UX", () => {
  it.each([
    [78_00_000, "₹78 L"],
    [1_00_000, "₹1 L"],
    [1_50_00_000, "₹1.5 Cr"],
    [1_25_00_000, "₹1.25 Cr"],
    [3_00_00_000, "₹3 Cr"],
    [2_85_00_000, "₹2.85 Cr"],
    [15_000, "₹15,000"],
    [48_000, "₹48,000"],
    [99_999, "₹99,999"],
  ])("%i is shown as %s", (rupees, expected) => {
    expect(formatPrice(translate, "en", rupees)).toBe(expected);
  });

  it("rounding up to 100 L reads as 1 Cr, never 100 L", () => {
    expect(formatPrice(translate, "en", 99_99_999)).toBe("₹1 Cr");
  });

  it("at most two decimals, trailing zeros dropped", () => {
    expect(formatPrice(translate, "en", 1_23_45_678)).toBe("₹1.23 Cr");
    expect(formatPrice(translate, "en", 54_20_000)).toBe("₹54.2 L");
  });

  it("rent adds /mo to the same price", () => {
    expect(formatRent(translate, "en", 48_000)).toBe("₹48,000/mo");
    expect(formatRent(translate, "en", 1_00_000)).toBe("₹1 L/mo");
  });

  it("price per sq.ft and area use Indian digit grouping", () => {
    expect(formatPerSqft(translate, "en", 8_906)).toBe("₹8,906 per sq.ft");
    expect(formatPerSqft(translate, "en", 1_20_000)).toBe("₹1,20,000 per sq.ft");
    expect(formatArea(translate, "en", 1_420)).toBe("1,420 sq.ft");
    expect(formatArea(translate, "en", 1_20_000)).toBe("1,20,000 sq.ft");
  });
});

describe("UT-format: dates are stored in UTC and shown in India time", () => {
  it("shows the Indian calendar day, not the UTC one", () => {
    // 20:00 UTC on 30 Oct is already 1:30 am on 31 Oct in India.
    expect(formatDate("en", "2026-10-30T20:00:00Z", "medium")).toBe("31 Oct 2026");
  });

  it("shows the Indian time of day", () => {
    // 20:00 UTC is 1:30 am the next day in India.
    expect(formatTime("en", "2026-10-30T20:00:00Z")).toMatch(/^1:30\s?am$/i);
  });
});

describe("UT-format: the year for the copyright line", () => {
  it("follows India time, so the new year starts there first", () => {
    // 20:00 UTC on 31 Dec is already 1:30 am on 1 Jan in India.
    expect(calendarYear(new Date("2026-12-31T20:00:00Z"))).toBe(2027);
    expect(calendarYear(new Date("2026-12-31T10:00:00Z"))).toBe(2026);
  });
});

describe("UT-format: how long ago a listing went live", () => {
  it("says Today for the first day and for a date in the future", () => {
    expect(formatListedAgo(translate, 0)).toBe("Today");
    expect(formatListedAgo(translate, 0.9)).toBe("Today");
    expect(formatListedAgo(translate, -2)).toBe("Today");
  });

  it("counts days up to 29, with one day in the singular", () => {
    expect(formatListedAgo(translate, 1)).toBe("1 day ago");
    expect(formatListedAgo(translate, 3.7)).toBe("3 days ago");
    expect(formatListedAgo(translate, 12)).toBe("12 days ago");
    expect(formatListedAgo(translate, 29)).toBe("29 days ago");
  });

  it("then counts months of 30 days, and years", () => {
    expect(formatListedAgo(translate, 30)).toBe("1 month ago");
    expect(formatListedAgo(translate, 75)).toBe("2 months ago");
    expect(formatListedAgo(translate, 364)).toBe("12 months ago");
    expect(formatListedAgo(translate, 365)).toBe("1 year ago");
    expect(formatListedAgo(translate, 800)).toBe("2 years ago");
  });
});

describe("UT-format: acres and months", () => {
  it("writes land area in acres with at most two decimals", () => {
    expect(formatAcres(translate, "en", 4.2)).toBe("4.2 acres");
    expect(formatAcres(translate, "en", 12)).toBe("12 acres");
    expect(formatAcres(translate, "en", 0.125)).toBe("0.13 acres");
  });
  it("writes a stored day as its month and year, or the short month alone", () => {
    expect(formatMonth("en", "2028-12-31")).toBe("Dec 2028");
    expect(formatMonth("en", "2026-03-01", "short")).toBe("Mar");
  });
  it("does not slip into the day before in any time zone", () => {
    expect(formatMonth("en", "2026-03-01")).toBe("Mar 2026");
  });
  it("gives nothing for text that is not a day", () => {
    expect(formatMonth("en", "soon")).toBe("");
  });
});
