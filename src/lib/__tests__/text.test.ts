import { describe, expect, it } from "vitest";
import { textParagraphs, uniqueTexts } from "../text";

describe("textParagraphs", () => {
  it("is empty for no text", () => {
    expect(textParagraphs(null)).toEqual([]);
    expect(textParagraphs("  \n\n  ")).toEqual([]);
  });
  it("starts a paragraph at a blank line and keeps a single break inside one", () => {
    expect(textParagraphs("One\nstill one\n\nTwo\r\n\r\nThree")).toEqual([
      "One\nstill one",
      "Two",
      "Three",
    ]);
  });
});

describe("uniqueTexts", () => {
  it("trims, drops empty entries and repeats (capitals ignored), and keeps the order", () => {
    expect(uniqueTexts([" Gym ", "", "gym", "Pool", "  ", "POOL", "Lift"])).toEqual([
      "Gym",
      "Pool",
      "Lift",
    ]);
  });
});
