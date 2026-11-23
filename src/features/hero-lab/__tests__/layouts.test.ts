import { describe, expect, it } from "vitest";
import { heroLabLetter, isExperiment, parseHeroLabLayout } from "../layouts";

describe("hero lab layouts", () => {
  it("reads a layout from the address by letter or by name, in any case", () => {
    expect(parseHeroLabLayout("c")).toBe("conversational");
    expect(parseHeroLabLayout(" D ")).toBe("layered");
    expect(parseHeroLabLayout("conversational")).toBe("conversational");
    expect(parseHeroLabLayout("a")).toBe("desk");
    expect(parseHeroLabLayout("b")).toBe("split");
  });

  it("ignores anything else, so the live layout is shown", () => {
    expect(parseHeroLabLayout(null)).toBeNull();
    expect(parseHeroLabLayout("")).toBeNull();
    expect(parseHeroLabLayout("e")).toBeNull();
    expect(parseHeroLabLayout("bento")).toBeNull();
  });

  it("writes the letter back to the address and marks only C and D as experiments", () => {
    expect(heroLabLetter("layered")).toBe("d");
    expect(isExperiment("conversational")).toBe(true);
    expect(isExperiment("layered")).toBe(true);
    expect(isExperiment("desk")).toBe(false);
    expect(isExperiment("split")).toBe(false);
    expect(isExperiment(null)).toBe(false);
  });
});
