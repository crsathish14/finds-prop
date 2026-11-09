import { describe, expect, it } from "vitest";
import { addDays, indiaToday, insightsHref, resolveInsightsRange } from "../range";

// 14:00 UTC on 9 Nov is 19:30 in India: the same day.
const NOW = new Date("2026-11-09T14:00:00Z");

describe("UT-insights-range: the date choice, in India days (S7-T03 step E)", () => {
  it("takes the day in India, not in UTC: 19:00 UTC on 31 Oct is already 1 Nov", () => {
    expect(indiaToday(new Date("2026-10-31T18:00:00Z"))).toBe("2026-10-31");
    expect(indiaToday(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11-01");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-03", -6)).toBe("2026-10-28");
    expect(addDays("2026-01-02", -5)).toBe("2025-12-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("makes 30 days the default, today counted as one of them", () => {
    expect(resolveInsightsRange({}, NOW)).toEqual({
      range: "30",
      from: "2026-10-11",
      to: "2026-11-09",
    });
    expect(resolveInsightsRange({ range: "30" }, NOW).range).toBe("30");
  });

  it("makes 7 days end today and start six days before", () => {
    expect(resolveInsightsRange({ range: "7" }, NOW)).toEqual({
      range: "7",
      from: "2026-11-03",
      to: "2026-11-09",
    });
  });

  it("runs 'This month' from the 1st to today, even on the 1st", () => {
    expect(resolveInsightsRange({ range: "month" }, NOW)).toEqual({
      range: "month",
      from: "2026-11-01",
      to: "2026-11-09",
    });
    expect(
      resolveInsightsRange({ range: "month" }, new Date("2026-10-31T19:00:00Z")),
    ).toMatchObject({ from: "2026-11-01", to: "2026-11-01" });
  });

  it("takes a custom range of two real days, the first not after the second", () => {
    expect(
      resolveInsightsRange({ range: "custom", from: "2026-10-01", to: "2026-10-28" }, NOW),
    ).toEqual({ range: "custom", from: "2026-10-01", to: "2026-10-28" });
    expect(
      resolveInsightsRange({ range: "custom", from: "2026-10-05", to: "2026-10-05" }, NOW).range,
    ).toBe("custom");
  });

  it.each([
    ["an end before the start", { from: "2026-10-28", to: "2026-10-01" }],
    ["a day that does not exist", { from: "2026-02-30", to: "2026-03-05" }],
    ["text that is not a day", { from: "last week", to: "2026-03-05" }],
    ["a missing end", { from: "2026-10-01" }],
    ["more than a year", { from: "2025-10-01", to: "2026-10-28" }],
  ])("falls back to 30 days for %s", (_why, days) => {
    expect(resolveInsightsRange({ range: "custom", ...days }, NOW).range).toBe("30");
  });

  it("falls back to 30 days for a range it does not know", () => {
    expect(resolveInsightsRange({ range: "forever" }, NOW).range).toBe("30");
  });

  it("allows exactly a year, and no more", () => {
    expect(
      resolveInsightsRange({ range: "custom", from: "2025-10-28", to: "2026-10-28" }, NOW).range,
    ).toBe("custom");
  });
});

describe("UT-insights-href: the address of a page for some choices (S7-T03 step E)", () => {
  it("leaves out the default range and an empty project", () => {
    expect(insightsHref("/builder/insights", { range: "30" })).toBe("/builder/insights");
  });

  it("names a range that is not the default, and a project when one is chosen", () => {
    expect(insightsHref("/builder/insights", { range: "7", project: "p1" })).toBe(
      "/builder/insights?range=7&project=p1",
    );
  });

  it("names the two days of a custom range, and only for it", () => {
    expect(
      insightsHref("/builder/dashboard", { range: "custom", from: "2026-10-01", to: "2026-10-28" }),
    ).toBe("/builder/dashboard?range=custom&from=2026-10-01&to=2026-10-28");
    expect(
      insightsHref("/builder/dashboard", { range: "month", from: "2026-11-01", to: "2026-11-09" }),
    ).toBe("/builder/dashboard?range=month");
  });
});
