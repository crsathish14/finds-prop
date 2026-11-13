import { describe, expect, it } from "vitest";
import { MAX_UNTRUSTED_TEXT_CHARACTERS } from "@/config/ai";
import {
  cleanOptionalLine,
  cleanThirdPartyLine,
  cleanThirdPartyText,
  UNTRUSTED_TEXT_KEY,
} from "../untrusted";

// UT-ai-untrusted (ADR-128 sections 5.4 and 6.2): third-party text is kept under one key, cleaned of
// characters that show nothing, and cut to a fixed length. The text below is made up. Every invisible
// character is written as its number, so none sits in this file where a reviewer cannot see it.

const character = (codePoint: number) => String.fromCodePoint(codePoint);

const NULL_CHARACTER = character(0x00);
const BELL = character(0x07);
const SOFT_HYPHEN = character(0xad);
const ZERO_WIDTH_SPACE = character(0x200b);
const ZERO_WIDTH_NON_JOINER = character(0x200c);
const ZERO_WIDTH_JOINER = character(0x200d);
const RIGHT_TO_LEFT_OVERRIDE = character(0x202e);
const ISOLATE_START = character(0x2066);
const ISOLATE_END = character(0x2069);
const BYTE_ORDER_MARK = character(0xfeff);
/** The first half of a two-part character, on its own. */
const BROKEN_HALF = String.fromCharCode(0xd83d);

/** "hidden" written in the invisible tag letters, which a person cannot see and a model can read. */
const TAG_LETTERS = Array.from("hidden", (letter) =>
  character(0xe0000 + (letter.codePointAt(0) ?? 0)),
).join("");

describe("UT-ai-untrusted: the key", () => {
  it("is untrustedText", () => {
    expect(UNTRUSTED_TEXT_KEY).toBe("untrustedText");
  });
});

describe("UT-ai-untrusted: cleaning", () => {
  it("leaves ordinary English and Tamil text as it is", () => {
    expect(cleanThirdPartyText("2 BHK flat near the lake")).toEqual({
      text: "2 BHK flat near the lake",
      shortened: false,
    });
    expect(cleanThirdPartyLine("வேளச்சேரி ஏரி அருகில்")).toBe("வேளச்சேரி ஏரி அருகில்");
  });

  it("removes the invisible tag letters that can hide an instruction", () => {
    expect(TAG_LETTERS).toHaveLength(12);
    expect(cleanThirdPartyLine(`Sunny flat${TAG_LETTERS}`)).toBe("Sunny flat");
  });

  it("removes controls, direction overrides, the soft hyphen and the byte-order mark", () => {
    const typed = [
      `Sea${NULL_CHARACTER}`,
      `view${RIGHT_TO_LEFT_OVERRIDE}`,
      `flat${ISOLATE_START}${ISOLATE_END}`,
      `on${SOFT_HYPHEN}`,
      `the${BYTE_ORDER_MARK}`,
      `beach${BELL}`,
    ].join(" ");
    expect(typed).not.toBe("Sea view flat on the beach");
    expect(cleanThirdPartyLine(typed)).toBe("Sea view flat on the beach");
  });

  it("removes a broken half of a character", () => {
    expect(cleanThirdPartyLine(`Flat ${BROKEN_HALF} near park`)).toBe("Flat near park");
  });

  it("keeps the zero-width joiners, which some scripts need to draw a letter", () => {
    const joined = `ka${ZERO_WIDTH_JOINER}ssa`;
    const notJoined = `ka${ZERO_WIDTH_NON_JOINER}ssa`;
    expect(cleanThirdPartyLine(joined)).toBe(joined);
    expect(cleanThirdPartyLine(notJoined)).toBe(notJoined);
    expect(joined).toHaveLength(6);
  });

  it("keeps the line breaks of a description and trims its ends", () => {
    expect(cleanThirdPartyText("  First line\r\nSecond line\rThird\tline\n\n ").text).toBe(
      "First line\nSecond line\nThird line",
    );
  });

  it("makes one line of a title: every run of space is one space", () => {
    expect(cleanThirdPartyLine("  3 BHK \n\n villa\twith   garden ")).toBe(
      "3 BHK villa with garden",
    );
  });

  it("reads a field the owner left out, or left blank, as nothing", () => {
    expect(cleanOptionalLine(null)).toBeNull();
    expect(cleanOptionalLine(` ${ZERO_WIDTH_SPACE} `)).toBeNull();
    expect(cleanOptionalLine(" Adyar ")).toBe("Adyar");
  });
});

describe("UT-ai-untrusted: the length", () => {
  it("keeps text up to the limit whole", () => {
    const text = "a".repeat(MAX_UNTRUSTED_TEXT_CHARACTERS);
    expect(cleanThirdPartyText(text)).toEqual({ text, shortened: false });
  });

  it("cuts longer text at the limit and says so", () => {
    const cut = cleanThirdPartyText("a".repeat(MAX_UNTRUSTED_TEXT_CHARACTERS + 1));
    expect(cut.shortened).toBe(true);
    expect(cut.text).toHaveLength(MAX_UNTRUSTED_TEXT_CHARACTERS);
  });

  it("counts whole characters, so a cut never leaves half of one", () => {
    const cut = cleanThirdPartyText("🏠🏠🏠🏠", 3);
    expect(cut).toEqual({ text: "🏠🏠🏠", shortened: true });
  });

  it("does not end a cut with a space", () => {
    expect(cleanThirdPartyText("one two three", 4)).toEqual({ text: "one", shortened: true });
  });

  it("cuts a single line the same way", () => {
    expect(cleanThirdPartyLine("Velachery main road", 9)).toBe("Velachery");
  });
});
