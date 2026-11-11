import { describe, expect, it } from "vitest";
import { overviewHref, resolveOverviewRange } from "../range";

// 20:00 UTC on 10 Nov is 01:30 on 11 Nov in India, so "today" there is 11 Nov, not the UTC day.
const NOW = new Date("2026-11-10T20:00:00Z");

describe("UT-overview-range: the date choice of the admin's Overview, in India days (S7-T06 part 3)", () => {
  it("makes 30 days the default, today counted as one of them, and answers the same to nothing or nonsense", () => {
    const expected = { range: "30", from: "2026-10-13", to: "2026-11-11" };
    expect(resolveOverviewRange({}, NOW)).toEqual(expected);
    expect(resolveOverviewRange({ range: "30" }, NOW)).toEqual(expected);
    expect(resolveOverviewRange({ range: "fortnight" }, NOW)).toEqual(expected);
  });

  it("makes Today the day in India, not in UTC", () => {
    expect(resolveOverviewRange({ range: "today" }, NOW)).toEqual({
      range: "today",
      from: "2026-11-11",
      to: "2026-11-11",
    });
  });

  it("makes Yesterday the one day before, across a month end", () => {
    expect(resolveOverviewRange({ range: "yesterday" }, NOW)).toEqual({
      range: "yesterday",
      from: "2026-11-10",
      to: "2026-11-10",
    });
    expect(resolveOverviewRange({ range: "yesterday" }, new Date("2026-11-01T02:00:00Z"))).toEqual({
      range: "yesterday",
      from: "2026-10-31",
      to: "2026-10-31",
    });
  });

  it("makes 7 days end today and start six days before", () => {
    expect(resolveOverviewRange({ range: "7" }, NOW)).toEqual({
      range: "7",
      from: "2026-11-05",
      to: "2026-11-11",
    });
  });

  it("runs 'This month' from the 1st to today, even on the 1st", () => {
    expect(resolveOverviewRange({ range: "month" }, NOW)).toEqual({
      range: "month",
      from: "2026-11-01",
      to: "2026-11-11",
    });
    expect(resolveOverviewRange({ range: "month" }, new Date("2026-11-30T19:00:00Z"))).toEqual({
      range: "month",
      from: "2026-12-01",
      to: "2026-12-01",
    });
  });

  it("takes a custom range of two real days, the first not after the second", () => {
    expect(
      resolveOverviewRange({ range: "custom", from: "2026-10-01", to: "2026-10-28" }, NOW),
    ).toEqual({ range: "custom", from: "2026-10-01", to: "2026-10-28" });
    expect(
      resolveOverviewRange({ range: "custom", from: "2026-10-05", to: "2026-10-05" }, NOW),
    ).toEqual({ range: "custom", from: "2026-10-05", to: "2026-10-05" });
  });

  it("falls back to 30 days for a custom range that is not usable", () => {
    const fallback = { range: "30", from: "2026-10-13", to: "2026-11-11" };
    const custom = (from?: string, to?: string) =>
      resolveOverviewRange({ range: "custom", from, to }, NOW);
    expect(custom()).toEqual(fallback);
    expect(custom("2026-10-28", "2026-10-01")).toEqual(fallback);
    expect(custom("2026-02-31", "2026-03-02")).toEqual(fallback);
    expect(custom("1 Oct 2026", "28 Oct 2026")).toEqual(fallback);
  });

  it("allows a year, and no more", () => {
    expect(
      resolveOverviewRange({ range: "custom", from: "2025-10-31", to: "2026-10-31" }, NOW).range,
    ).toBe("custom");
    expect(
      resolveOverviewRange({ range: "custom", from: "2025-10-30", to: "2026-10-31" }, NOW).range,
    ).toBe("30");
  });
});

describe("UT-overview-href: the address of the page for some choices (S7-T06 part 3)", () => {
  it("leaves out the default range", () => {
    expect(overviewHref("/admin/dashboard", { range: "30" })).toBe("/admin/dashboard");
  });

  it("names a range that is not the default", () => {
    expect(overviewHref("/admin/dashboard", { range: "today" })).toBe(
      "/admin/dashboard?range=today",
    );
    expect(overviewHref("/admin/dashboard", { range: "month" })).toBe(
      "/admin/dashboard?range=month",
    );
  });

  it("names the two days of a custom range, and only for it", () => {
    expect(
      overviewHref("/admin/dashboard", { range: "custom", from: "2026-10-01", to: "2026-10-28" }),
    ).toBe("/admin/dashboard?range=custom&from=2026-10-01&to=2026-10-28");
    expect(
      overviewHref("/admin/dashboard", { range: "7", from: "2026-11-05", to: "2026-11-11" }),
    ).toBe("/admin/dashboard?range=7");
  });
});
