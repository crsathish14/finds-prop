import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import {
  formatArea,
  formatDate,
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
});
