import { describe, expect, it } from "vitest";
import { resolveCity, withDefaultCity, type CityOption } from "../list";

const coimbatore: CityOption = { key: "coimbatore", name: "Coimbatore", count: 4 };
const chennai: CityOption = { key: "chennai", name: "Chennai", count: 9 };

describe("withDefaultCity", () => {
  it("adds Chennai first when no home is listed there", () => {
    expect(withDefaultCity([coimbatore])).toEqual([
      { key: "chennai", name: "Chennai", count: 0 },
      coimbatore,
    ]);
  });

  it("leaves the list alone when Chennai is in it", () => {
    const list = [coimbatore, chennai];
    expect(withDefaultCity(list)).toBe(list);
  });
});

describe("resolveCity", () => {
  it("uses the remembered city when it is listed", () => {
    expect(resolveCity("coimbatore", [chennai, coimbatore])).toBe(coimbatore);
  });

  it("falls back to Chennai when nobody has chosen", () => {
    expect(resolveCity(undefined, [coimbatore, chennai])).toBe(chennai);
  });

  it("falls back to Chennai for a city that is not listed (an old or made-up cookie)", () => {
    expect(resolveCity("atlantis", [coimbatore]).key).toBe("chennai");
  });
});
