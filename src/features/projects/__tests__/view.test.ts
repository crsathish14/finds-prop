import { describe, expect, it } from "vitest";
import type { ProjectData, ProjectUnit, TrendPoint } from "../types";
import {
  bhkSizes,
  orderUnits,
  priceBounds,
  reraTag,
  specItems,
  trendSeries,
  unitsSummary,
  videoLinks,
} from "../view";

const project = (overrides: Partial<ProjectData> = {}): ProjectData => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kadal-vista",
  name: "Kadal Vista",
  developer: { id: "00000000-0000-4000-8000-0000000000aa", name: "Kadal Homes" },
  status: "under_construction",
  priceMin: 7_800_000,
  priceMax: 14_200_000,
  bhkOptions: [3, 2],
  landAreaAcres: 4.2,
  totalUnits: 320,
  possessionDate: "2028-12-31",
  contactPhone: "+914412345678",
  locality: "OMR Navalur",
  advantages: [],
  nearby: [],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
  description: null,
  specifications: null,
  amenities: [],
  images: [],
  floorPlans: [],
  videos: [],
  brochurePath: null,
  seoTitle: null,
  seoDescription: null,
  featured: false,
  units: [],
  unitCount: 320,
  availableCount: 184,
  trend: [],
  ...overrides,
});

const unit = (number: string, floor: number | null): ProjectUnit => ({
  number,
  floor,
  bhk: 2,
  areaSqft: 1000,
  facing: null,
  price: null,
  status: "available",
  floorPlanPath: null,
});

describe("UT-project-view: what the project pages show", () => {
  describe("bhkSizes", () => {
    it("lists each size once, smallest first, and drops 0", () => {
      expect(bhkSizes([3, 2, 3, 0, 4])).toEqual([2, 3, 4]);
      expect(bhkSizes([])).toEqual([]);
    });
  });

  describe("priceBounds", () => {
    it("gives the range lowest first, whatever order it is given in", () => {
      expect(priceBounds(100, 300)).toEqual({ low: 100, high: 300 });
      expect(priceBounds(300, 100)).toEqual({ low: 100, high: 300 });
    });
    it("makes one price a range with equal ends", () => {
      expect(priceBounds(100, null)).toEqual({ low: 100, high: 100 });
      expect(priceBounds(null, 300)).toEqual({ low: 300, high: 300 });
    });
    it("gives nothing when no price, or only 0, is given", () => {
      expect(priceBounds(null, null)).toBeNull();
      expect(priceBounds(0, 0)).toBeNull();
    });
  });

  describe("specItems", () => {
    it("lists the facts in the order of the UX", () => {
      expect(specItems(project()).map((item) => item.key)).toEqual([
        "priceRange",
        "configuration",
        "status",
        "possession",
        "landArea",
        "totalUnits",
        "availableUnits",
        "rera",
      ]);
    });

    it("carries each fact's value", () => {
      const items = specItems(project());
      expect(items[0]).toEqual({ key: "priceRange", low: 7_800_000, high: 14_200_000 });
      expect(items[1]).toEqual({ key: "configuration", sizes: [2, 3] });
      expect(items[2]).toEqual({ key: "status", value: "under_construction" });
      expect(items[3]).toEqual({ key: "possession", date: "2028-12-31" });
      expect(items[4]).toEqual({ key: "landArea", acres: 4.2 });
      expect(items[5]).toEqual({ key: "totalUnits", value: 320 });
      expect(items[6]).toEqual({ key: "availableUnits", value: 184 });
      expect(items[7]).toEqual({ key: "rera", number: "TN/SAMPLE/0000" });
    });

    it("leaves out what the developer did not give, never drawing a blank or a zero", () => {
      const sparse = project({
        priceMin: null,
        priceMax: null,
        bhkOptions: [],
        status: null,
        possessionDate: null,
        landAreaAcres: 0,
        totalUnits: null,
        unitCount: 0,
        availableCount: 0,
        reraApplicable: false,
        reraNumber: null,
      });
      expect(specItems(sparse)).toEqual([]);
    });

    it("leaves out a possession date that is not a real day", () => {
      expect(
        specItems(project({ possessionDate: "2028-13-45" })).map((item) => item.key),
      ).not.toContain("possession");
      expect(specItems(project({ possessionDate: "soon" })).map((item) => item.key)).not.toContain(
        "possession",
      );
    });

    it("counts available units only when units are listed, and then even when none is available", () => {
      expect(
        specItems(project({ unitCount: 0, availableCount: 0 })).map((item) => item.key),
      ).not.toContain("availableUnits");
      const none = specItems(project({ unitCount: 12, availableCount: 0 })).find(
        (item) => item.key === "availableUnits",
      );
      expect(none).toEqual({ key: "availableUnits", value: 0 });
    });

    it("draws a RERA number only for a project under RERA that has one", () => {
      const keys = (overrides: Partial<ProjectData>) =>
        specItems(project(overrides)).map((item) => item.key);
      expect(keys({ reraApplicable: false, reraNumber: null })).not.toContain("rera");
      expect(keys({ reraApplicable: true, reraNumber: null })).not.toContain("rera");
      expect(keys({ reraApplicable: true, reraNumber: "   " })).not.toContain("rera");
    });
  });

  describe("reraTag", () => {
    it("is nothing for a project that is not under RERA", () => {
      expect(reraTag({ reraApplicable: false, reraNumber: null })).toBeNull();
    });
    it("carries the number when there is one", () => {
      expect(reraTag({ reraApplicable: true, reraNumber: " TN/1 " })).toEqual({ number: "TN/1" });
    });
    it("is the bare tag when under RERA with no number", () => {
      expect(reraTag({ reraApplicable: true, reraNumber: null })).toEqual({ number: null });
      expect(reraTag({ reraApplicable: true, reraNumber: "" })).toEqual({ number: null });
    });
  });

  describe("orderUnits", () => {
    it("orders by floor, then by unit number read with its numbers as numbers", () => {
      const ordered = orderUnits([
        unit("A-10", 1),
        unit("B-301", 3),
        unit("A-2", 1),
        unit("A-201", 2),
      ]);
      expect(ordered.map((entry) => entry.number)).toEqual(["A-2", "A-10", "A-201", "B-301"]);
    });
    it("puts units with no floor last", () => {
      const ordered = orderUnits([unit("Z-1", null), unit("A-1", 5), unit("A-0", -1)]);
      expect(ordered.map((entry) => entry.number)).toEqual(["A-0", "A-1", "Z-1"]);
    });
    it("does not change the list it is given", () => {
      const given = [unit("B", 2), unit("A", 1)];
      orderUnits(given);
      expect(given.map((entry) => entry.number)).toEqual(["B", "A"]);
    });
  });

  describe("unitsSummary", () => {
    it("says how many rows are drawn of how many units", () => {
      expect(unitsSummary({ units: [unit("A", 1), unit("B", 1)], unitCount: 320 })).toEqual({
        shown: 2,
        total: 320,
      });
    });
    it("never claims fewer units than rows", () => {
      expect(unitsSummary({ units: [unit("A", 1), unit("B", 1)], unitCount: 1 })).toEqual({
        shown: 2,
        total: 2,
      });
    });
    it("is nothing when there are no units", () => {
      expect(unitsSummary({ units: [], unitCount: 0 })).toBeNull();
    });
  });

  describe("trendSeries", () => {
    const point = (month: string, pricePerSqft: number): TrendPoint => ({ month, pricePerSqft });
    it("orders the months oldest first", () => {
      const series = trendSeries([
        point("2026-10-01", 3),
        point("2026-08-01", 1),
        point("2026-09-01", 2),
      ]);
      expect(series.map((entry) => entry.pricePerSqft)).toEqual([1, 2, 3]);
    });
    it("keeps each month once, the later entry winning", () => {
      const series = trendSeries([point("2026-08-01", 1), point("2026-08-01", 9)]);
      expect(series).toEqual([point("2026-08-01", 9)]);
    });
    it("is empty for no months", () => {
      expect(trendSeries([])).toEqual([]);
    });
  });

  describe("videoLinks", () => {
    it("keeps https links, each once", () => {
      expect(videoLinks(["https://youtu.be/abc", "https://youtu.be/abc"])).toEqual([
        "https://youtu.be/abc",
      ]);
    });
    it("drops anything a page should not open", () => {
      expect(
        videoLinks([
          "http://example.com/v",
          "javascript:alert(1)",
          "data:text/html,hi",
          "https://user:pass@example.com/v",
          "https://user@example.com/v",
          "not a link",
          "",
          "ftp://example.com/v",
        ]),
      ).toEqual([]);
    });
    it("trims the text and shows at most five", () => {
      const many = Array.from({ length: 8 }, (_, index) => ` https://example.com/v${index} `);
      const links = videoLinks(many);
      expect(links).toHaveLength(5);
      expect(links[0]).toBe("https://example.com/v0");
    });
  });
});
