import { describe, expect, it } from "vitest";
import { clickRate, reportPeriodOf, reportRange, reportRows } from "../report";

describe("UT-sponsor-report: the report's periods and rows (ADR-194)", () => {
  it("takes 7, 30 or 90 days from the address, and 30 for anything else", () => {
    expect(reportPeriodOf("7")).toBe(7);
    expect(reportPeriodOf(["90", "7"])).toBe(90);
    expect(reportPeriodOf("365")).toBe(30);
    expect(reportPeriodOf("abc")).toBe(30);
    expect(reportPeriodOf(undefined)).toBe(30);
  });

  it("covers the days that end today in India, both included", () => {
    // 20:00 UTC on 24 Nov is already 25 Nov in India
    expect(reportRange(7, new Date("2026-11-24T20:00:00Z"))).toEqual({
      from: "2026-11-19",
      to: "2026-11-25",
    });
    expect(reportRange(30, new Date("2026-03-01T06:00:00Z"))).toEqual({
      from: "2026-01-31",
      to: "2026-03-01",
    });
    expect(reportRange(1, new Date("2026-11-24T06:00:00Z"))).toEqual({
      from: "2026-11-24",
      to: "2026-11-24",
    });
  });

  it("lists every sponsor shown now, then the others counted, most viewed first", () => {
    const rows = reportRows(
      [
        { slot: "hero", key: "ad-1", views: 120, clicks: 6 },
        { slot: "hero", key: "ad-old", views: 40, clicks: 1 },
        { slot: "hero", key: "ad-gone", views: 90, clicks: 0 },
        { slot: "results", key: "b9", views: 5, clicks: 1 },
      ],
      {
        hero: [
          { key: "ad-2", name: "Sea Homes" },
          { key: "ad-1", name: "Lake Homes" },
        ],
        results: [{ key: "b1", name: "Kadal Homes" }],
        spotlight: [],
      },
      new Map([
        ["ad-old", "Old Homes"],
        ["b9", "Nila Habitats"],
      ]),
    );
    expect(rows.hero).toEqual([
      { key: "ad-2", name: "Sea Homes", live: true, views: 0, clicks: 0 },
      { key: "ad-1", name: "Lake Homes", live: true, views: 120, clicks: 6 },
      { key: "ad-gone", name: null, live: false, views: 90, clicks: 0 },
      { key: "ad-old", name: "Old Homes", live: false, views: 40, clicks: 1 },
    ]);
    expect(rows.results).toEqual([
      { key: "b1", name: "Kadal Homes", live: true, views: 0, clicks: 0 },
      { key: "b9", name: "Nila Habitats", live: false, views: 5, clicks: 1 },
    ]);
    expect(rows.spotlight).toEqual([]);
  });

  it("gives the clicks per hundred views to one decimal, and nothing with no views", () => {
    expect(clickRate(120, 6)).toBe(5);
    expect(clickRate(3, 1)).toBe(33.3);
    expect(clickRate(0, 0)).toBeNull();
  });
});
