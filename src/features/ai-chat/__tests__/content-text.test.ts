import { describe, expect, it } from "vitest";
import { CONTENT_ITEM_MAX_CHARACTERS, CONTENT_SNIPPET_CHARACTERS } from "@/config/ai";
import {
  cutAtWord,
  indiaDay,
  isCategorySlug,
  isContentId,
  passageAround,
  queryWords,
  selectSections,
  wordsFound,
} from "../content-text";

// UT-ai-content-text (ADR-143 section 6.2): which part of an article or a question the model is shown. Pure, so the
// text here is made up and every rule is checked directly.

describe("UT-ai-content-text: the words of a search", () => {
  it("lower-cases, keeps each word once and drops the very common ones", () => {
    expect(queryWords("What is the Registration charge for registration?")).toEqual([
      "registration",
      "charge",
    ]);
  });

  it("keeps Tamil words and numbers, and gives none for no query", () => {
    expect(queryWords("பதிவு கட்டணம் 2026")).toEqual(["பதிவு", "கட்டணம்", "2026"]);
    expect(queryWords(null)).toEqual([]);
    expect(queryWords("   ")).toEqual([]);
  });

  it("counts a word that is only part of a longer one, as a search does", () => {
    expect(
      wordsFound("Registration is done at the sub-registrar office", ["registr", "loan"]),
    ).toBe(1);
  });
});

describe("UT-ai-content-text: cutting at a word", () => {
  it("leaves a short text alone and cuts a long one at a word with an ellipsis, never past the limit", () => {
    expect(cutAtWord("short text", 50)).toBe("short text");
    const cut = cutAtWord("alpha beta gamma delta epsilon zeta", 20);
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(cut).toBe("alpha beta gamma…");
  });
});

describe("UT-ai-content-text: the passage a result shows", () => {
  const long = (word: string) => `${word} `.repeat(120).trim();

  it("is at most the snippet size, on one line", () => {
    const text = `${long("filler")}\n\n${long("charges")}`;
    const passage = passageAround(text, ["charges"], CONTENT_SNIPPET_CHARACTERS);
    expect(passage.length).toBeLessThanOrEqual(CONTENT_SNIPPET_CHARACTERS);
    expect(passage).not.toContain("\n");
  });

  it("takes the paragraph that holds most of the words", () => {
    const text =
      "An opening about nothing much.\n\nStamp duty and registration charges are paid together.\n\nA closing line.";
    expect(passageAround(text, ["stamp", "registration"], 300)).toBe(
      "Stamp duty and registration charges are paid together.",
    );
  });

  it("starts near the first word found when the paragraph is long, and says it begins mid-text", () => {
    const text = `${long("lead")} the registration charge is shown here ${long("tail")}`;
    const passage = passageAround(text, ["registration"], 120);
    expect(passage.startsWith("…")).toBe(true);
    expect(passage).toContain("registration");
    expect(passage.length).toBeLessThanOrEqual(121);
  });

  it("shows the beginning when no word is found", () => {
    const passage = passageAround(long("plain"), ["missing"], 60);
    expect(passage.startsWith("plain plain")).toBe(true);
  });
});

describe("UT-ai-content-text: the sections of one item", () => {
  const sections = [
    "Intro: why buying a home takes planning.",
    "Loan: documents needed for a home loan are listed here.",
    "Registration: the registration charge is paid at the sub-registrar office.",
    "Closing: a last word.",
  ];

  it("gives the sections that hold the words, in the order they are in the item", () => {
    const { text, partial } = selectSections(sections, ["registration"], 5000);
    expect(text).toBe(
      [
        "Intro: why buying a home takes planning.",
        "Loan: documents needed for a home loan are listed here.",
        "Registration: the registration charge is paid at the sub-registrar office.",
        "Closing: a last word.",
      ].join("\n\n"),
    );
    expect(partial).toBe(false);
  });

  it("chooses the best section first when there is room for one, and says the item holds more", () => {
    const { text, partial } = selectSections(sections, ["registration"], 60);
    expect(text).toBe("Registration: the registration charge is paid at the…");
    expect(partial).toBe(true);
  });

  it("starts from the beginning when no word is given or none is found", () => {
    expect(selectSections(sections, [], 60).text).toBe("Intro: why buying a home takes planning.");
    expect(selectSections(sections, ["zzz"], 60).text).toBe(
      "Intro: why buying a home takes planning.",
    );
  });

  it("never gives more than the limit, however long the item is", () => {
    const long = Array.from(
      { length: 30 },
      (_, index) => `Section ${index}: ${"words ".repeat(80)}`,
    );
    const picked = selectSections(long, ["words"], CONTENT_ITEM_MAX_CHARACTERS);
    expect(picked.text.length).toBeLessThanOrEqual(CONTENT_ITEM_MAX_CHARACTERS);
    expect(picked.partial).toBe(true);
    // About 2,500 characters really are used: the limit is not wasted.
    expect(picked.text.length).toBeGreaterThan(CONTENT_ITEM_MAX_CHARACTERS * 0.8);
  });

  it("cuts a single section longer than the limit at a word", () => {
    const only = [`Start ${"word ".repeat(1000)}`];
    const picked = selectSections(only, [], 300);
    expect(picked.text.length).toBeLessThanOrEqual(300);
    expect(picked.text.endsWith("…")).toBe(true);
    expect(picked.partial).toBe(true);
  });

  it("gives nothing for an item with no text", () => {
    expect(selectSections([], ["x"], 100)).toEqual({ text: "", partial: false });
    expect(selectSections(["  ", ""], [], 100)).toEqual({ text: "", partial: false });
  });
});

describe("UT-ai-content-text: dates, slugs and ids", () => {
  it("writes the day in India time", () => {
    expect(indiaDay("2026-11-05T20:00:00.000Z")).toBe("2026-11-06");
    expect(indiaDay("2026-11-05T08:00:00.000Z")).toBe("2026-11-05");
    expect(indiaDay(null)).toBeNull();
    expect(indiaDay("not a date")).toBeNull();
  });

  it("knows a category slug and an id by their shape", () => {
    expect(isCategorySlug("buying-guide")).toBe(true);
    expect(isCategorySlug("Buying Guide")).toBe(false);
    expect(isCategorySlug("-x")).toBe(false);
    expect(isContentId("a1000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isContentId("a1000000")).toBe(false);
    expect(isContentId("1; drop table blog_posts")).toBe(false);
  });
});
