import { describe, expect, it } from "vitest";
import { pickSpotlight, spotlightAbout, spotlightCandidates, yearsSince } from "../spotlight";

describe("UT-spotlight-rules: the Developer spotlight's choice and words (ADR-193)", () => {
  it("keeps the picked builders with a live project, in the order picked, with their projects", () => {
    const rows = [
      { builderId: "b2", slug: "p1" },
      { builderId: "b1", slug: "p2" },
      { builderId: "b2", slug: "p3" },
      { builderId: "b9", slug: "p4" },
      { builderId: "b2", slug: "p1" },
    ];
    expect(spotlightCandidates(rows, ["b1", "b3", "b2", "b1"])).toEqual([
      { builderId: "b1", slugs: ["p2"] },
      { builderId: "b2", slugs: ["p1", "p3"] },
    ]);
    expect(spotlightCandidates(rows, [])).toEqual([]);
  });

  it("picks one by chance, the only one there is, or nothing", () => {
    const three = ["a", "b", "c"];
    expect(pickSpotlight(three, () => 0)).toBe("a");
    expect(pickSpotlight(three, () => 0.5)).toBe("b");
    expect(pickSpotlight(three, () => 0.9999)).toBe("c");
    expect(pickSpotlight(three, () => 1)).toBe("c");
    expect(pickSpotlight(["only"], () => 0.7)).toBe("only");
    expect(pickSpotlight([], () => 0.3)).toBeNull();
  });

  it("uses the tagline, or else the start of the description cut at a word", () => {
    expect(spotlightAbout("  Homes by the lake  ", "Long text")).toBe("Homes by the lake");
    expect(spotlightAbout(null, "  Short   description. ")).toBe("Short description.");
    expect(spotlightAbout("", "one two three four five six", 14)).toBe("one two three…");
    expect(spotlightAbout(null, "We build, homes and more", 10)).toBe("We build…");
    expect(spotlightAbout(null, null)).toBeNull();
    expect(spotlightAbout(" ", " ")).toBeNull();
  });

  it("counts the whole years since the builder started, only when in the past", () => {
    expect(yearsSince(2001, 2026)).toBe(25);
    expect(yearsSince(2026, 2026)).toBeNull();
    expect(yearsSince(2030, 2026)).toBeNull();
    expect(yearsSince(null, 2026)).toBeNull();
  });
});
