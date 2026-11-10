import { describe, expect, it } from "vitest";
import {
  chartLocale,
  formatCount,
  formatPercent,
  labelEvery,
  niceTicks,
  seriesColor,
  spreadLabels,
} from "../chart-scale";

describe("UT-chart-scale: the numbers behind the charts (S7-T06)", () => {
  describe("niceTicks", () => {
    it("gives round steps up to a number at or above the biggest value", () => {
      expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
      expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
      expect(niceTicks(862)).toEqual([0, 250, 500, 750, 1000]);
      expect(niceTicks(1284)).toEqual([0, 500, 1000, 1500]);
      expect(niceTicks(10)).toEqual([0, 5, 10]);
    });

    it("never has a fraction, because the scale counts people and leads", () => {
      for (const max of [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 29, 47]) {
        expect(niceTicks(max).every((tick) => Number.isInteger(tick))).toBe(true);
      }
      expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    });

    it("ends at or above the biggest value, starting at 0, in steps of one size", () => {
      for (const max of [1, 7, 24, 99, 101, 640, 5000, 123456]) {
        const ticks = niceTicks(max);
        expect(ticks[0]).toBe(0);
        expect(ticks.at(-1) ?? 0).toBeGreaterThanOrEqual(max);
        const step = (ticks[1] ?? 0) - (ticks[0] ?? 0);
        expect(ticks.every((tick, index) => tick === index * step)).toBe(true);
      }
    });

    it("still gives a scale when there is nothing above 0, or the number is not usable", () => {
      expect(niceTicks(0)).toEqual([0, 1]);
      expect(niceTicks(-4)).toEqual([0, 1]);
      expect(niceTicks(Number.NaN)).toEqual([0, 1]);
      expect(niceTicks(1)).toEqual([0, 1]);
    });
  });

  it("shows about as many labels as fit along an axis", () => {
    expect(labelEvery(30, 6)).toBe(5);
    expect(labelEvery(30, 4)).toBe(8);
    expect(labelEvery(3, 6)).toBe(1);
    expect(labelEvery(0, 6)).toBe(1);
    expect(labelEvery(10, 0)).toBe(10);
  });

  it("colours a series by its slot, and 'other' apart from the four", () => {
    expect(seriesColor(1)).toBe("var(--c-series-1)");
    expect(seriesColor(4)).toBe("var(--c-series-4)");
    expect(seriesColor("other")).toBe("var(--c-series-other)");
  });

  it("writes English numbers the Indian way, and a share as a whole percent", () => {
    expect(chartLocale("en")).toBe("en-IN");
    expect(chartLocale("ta")).toBe("ta");
    expect(formatCount("en", 128400)).toBe("1,28,400");
    expect(formatCount("en", 862)).toBe("862");
    expect(formatPercent("en", 0.478)).toBe("48%");
    expect(formatPercent("en", 1)).toBe("100%");
  });

  describe("spreadLabels", () => {
    it("moves labels that would print over each other apart, keeping their order", () => {
      expect(spreadLabels([100, 102, 200], 16)).toEqual([100, 116, 200]);
      expect(spreadLabels([102, 100], 16)).toEqual([116, 100]);
    });

    it("pushes a run of close labels down one after another", () => {
      expect(spreadLabels([50, 52, 54], 16)).toEqual([50, 66, 82]);
    });

    it("leaves labels that already have room where they are, and an empty list empty", () => {
      expect(spreadLabels([10, 60, 120], 16)).toEqual([10, 60, 120]);
      expect(spreadLabels([], 16)).toEqual([]);
    });
  });
});
