import { describe, expect, it } from "vitest";
import {
  buildLink,
  findLinkProblem,
  isAllowedLinkUrl,
  parseInline,
  stripLinks,
  type InlineNode,
} from "../inline-links";

const text = (value: string): InlineNode => ({ kind: "text", text: value });
const link = (label: string, href: string): InlineNode => ({
  kind: "link",
  label,
  href,
  external: !href.startsWith("/"),
});

describe("UT-inline-links: the one link of an article (ADR-169)", () => {
  it("reads an https link and a path of the site", () => {
    expect(parseInline("Read [the guide](https://example.com/a?b=1#c) now")).toEqual([
      text("Read "),
      link("the guide", "https://example.com/a?b=1#c"),
      text(" now"),
    ]);
    expect(parseInline("Go [home](/) or [search](/properties?city=chennai).")).toEqual([
      text("Go "),
      link("home", "/"),
      text(" or "),
      link("search", "/properties?city=chennai"),
      text("."),
    ]);
  });

  it("reads several links and keeps the words between them", () => {
    expect(parseInline("[a](https://a.example)[b](/b)")).toEqual([
      link("a", "https://a.example"),
      link("b", "/b"),
    ]);
  });

  it("leaves text with no link as one piece, and empty text as nothing", () => {
    expect(parseInline("just words")).toEqual([text("just words")]);
    expect(parseInline("")).toEqual([]);
  });

  it.each([
    ["http", "[x](http://example.com)"],
    ["mailto", "[x](mailto:a@example.com)"],
    ["javascript", "[x](javascript:alert(1))"],
    ["data", "[x](data:text/html;base64,AAAA)"],
    ["protocol-relative", "[x](//evil.example/a)"],
    ["a backslash path", "[x](/\\evil.example)"],
    ["a space in the address", "[x](https://example.com/a b)"],
    ["a control character", "[x](https://example.com/a\u0001b)"],
    ["an upper case scheme", "[x](HTTPS://example.com)"],
    ["a host with no dot", "[x](https://localhost/a)"],
    ["credentials in the address", "[x](https://user@example.com)"],
    ["a non-ASCII host", "[x](https://exämple.com)"],
    ["a quote in the address", "[x](https://example.com/a'b)"],
    ["a relative address", "[x](below)"],
    ["an empty address", "[x]()"],
    ["an empty label", "[](https://example.com)"],
    ["a label that starts with a space", "[ x](https://example.com)"],
    ["brackets inside the label", "[a [b]](https://example.com)"],
    ["a parenthesis inside the label", "[a (b)](https://example.com)"],
    ["a parenthesis inside the address", "[x](https://example.com/a_(b))"],
    ["no closing parenthesis", "[x](https://example.com"],
    ["a line break in the label", "[a\nb](https://example.com)"],
  ])("keeps %s as plain text", (_name, source) => {
    expect(parseInline(source)).toEqual([text(source)]);
    expect(stripLinks(source)).toBe(source);
  });

  it("reads the inner link of nested brackets and leaves the rest as text", () => {
    expect(parseInline("[a [b](https://e.example)")).toEqual([
      text("[a "),
      link("b", "https://e.example"),
    ]);
  });

  it("handles a very long address and a very long label without hanging", () => {
    const long = `https://example.com/${"a".repeat(2000)}`;
    expect(parseInline(`[x](${long})`)).toEqual([text(`[x](${long})`)]);
    expect(isAllowedLinkUrl(`https://example.com/${"a".repeat(1980)}`)).toBe(true);
    expect(isAllowedLinkUrl(`https://example.com/${"a".repeat(1981)}`)).toBe(false);
    const longLabel = "a".repeat(161);
    expect(parseInline(`[${longLabel}](https://example.com)`)).toEqual([
      text(`[${longLabel}](https://example.com)`),
    ]);
    const hostile = `${"[".repeat(20000)}x${"]".repeat(20000)}(`;
    expect(parseInline(hostile)).toEqual([text(hostile)]);
  });

  it("counts a label's characters, not its UTF-16 units", () => {
    const label = "😀".repeat(160);
    expect(parseInline(`[${label}](/a)`)).toEqual([link(label, "/a")]);
    expect(parseInline(`[${label}😀](/a)`)).toHaveLength(1);
    expect(parseInline(`[${label}😀](/a)`)[0]?.kind).toBe("text");
  });

  it("strips each link to its label for the search, the reading time and the AI", () => {
    expect(stripLinks("See [the guide](https://example.com/a) and [home](/).")).toBe(
      "See the guide and home.",
    );
    expect(stripLinks("[bad](http://x.example) stays")).toBe("[bad](http://x.example) stays");
  });

  describe("findLinkProblem (what the editor and the schema refuse to save)", () => {
    it("accepts text with no link and text with allowed links", () => {
      expect(findLinkProblem("no links, just [1] and (two)")).toBeNull();
      expect(findLinkProblem("a [b](https://example.com) c [d](/e)")).toBeNull();
    });

    it.each([
      ["address", "[note](below)"],
      ["address", "[x](http://example.com)"],
      ["address", "[x](javascript:alert(1))"],
      ["address", "[x](//evil.example)"],
      ["address", "[x]()"],
      ["address", "[x](https://example.com/a b)"],
      ["label", "[](https://example.com)"],
      ["label", "[a (b)](https://example.com)"],
      ["label", `[${"a".repeat(161)}](https://example.com)`],
      ["tooLong", `[x](https://example.com/${"a".repeat(2000)})`],
    ])("names the %s problem in %s", (problem, source) => {
      expect(findLinkProblem(source)).toBe(problem);
    });
  });

  describe("buildLink (the editor's form)", () => {
    it("makes the syntax from tidy words and an address", () => {
      expect(buildLink("  The   guide ", " https://example.com/a ")).toEqual({
        ok: true,
        syntax: "[The guide](https://example.com/a)",
      });
      expect(buildLink("Home", "/")).toEqual({ ok: true, syntax: "[Home](/)" });
    });

    it("says what is wrong", () => {
      expect(buildLink("", "https://example.com")).toEqual({ ok: false, problem: "label" });
      expect(buildLink("a ] b", "https://example.com")).toEqual({ ok: false, problem: "label" });
      expect(buildLink("x", "http://example.com")).toEqual({ ok: false, problem: "address" });
      expect(buildLink("x", "https://example.com/a)b")).toEqual({ ok: false, problem: "address" });
      expect(buildLink("x", `https://example.com/${"a".repeat(2000)}`)).toEqual({
        ok: false,
        problem: "tooLong",
      });
    });
  });
});
