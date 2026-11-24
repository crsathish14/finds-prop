import { describe, expect, it } from "vitest";
import { HOME_SECTION_KEYS, resolveHomeOrder } from "../home-order";

describe("resolveHomeOrder", () => {
  it("is the built-in order when nothing is saved", () => {
    expect(resolveHomeOrder()).toEqual([...HOME_SECTION_KEYS]);
    expect(resolveHomeOrder([])).toEqual([...HOME_SECTION_KEYS]);
  });

  it("keeps the saved order, drops unknown and repeated keys, and appends missing sections", () => {
    expect(resolveHomeOrder(["cta", "nonsense", "featured", "cta"])).toEqual([
      "cta",
      "featured",
      "discovery",
      "newLaunches",
      "spotlight",
      "projectTypes",
      "newest",
      "whyUs",
    ]);
  });

  it("always returns every section exactly once", () => {
    const order = resolveHomeOrder(["whyUs", "newest"]);
    expect(order).toHaveLength(HOME_SECTION_KEYS.length);
    expect(new Set(order).size).toBe(HOME_SECTION_KEYS.length);
  });
});
