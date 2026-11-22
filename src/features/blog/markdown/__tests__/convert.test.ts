import { describe, expect, it } from "vitest";
import { bodySchema } from "../../schemas";
import { convertMarkdown, MARKDOWN_MAX_CHARS, type MarkdownConversion } from "../convert";

const codes = (result: MarkdownConversion): string[] =>
  result.warnings.map((warning) => warning.code);

/** What the server does with the blocks: the article's own schema. */
const accepted = (result: MarkdownConversion): boolean =>
  bodySchema.safeParse(result.blocks).success;

const ARTICLE = `# How to check a plot before you buy it in Chennai

Buying land is a big decision. Here is **a short guide** to the papers you should ask for.

## What to ask the seller

- The *parent* document
- The latest [encumbrance certificate](https://www.tnreginet.gov.in/portal)
- Patta and chitta

## The steps

1. Visit the sub-registrar's office
2. Check the survey number
3. Pay the fee

> Never pay in cash without a receipt.
> — Asha Rao

| Paper | Where |
| ----- | ----- |
| EC | Sub-registrar |

#realestate #chennai #plots
`;

describe("convertMarkdown: a pasted article (ADR-172)", () => {
  it("makes the title, the blocks, the address and the excerpt", () => {
    const result = convertMarkdown(ARTICLE);
    expect(result.title).toBe("How to check a plot before you buy it in Chennai");
    expect(result.slug).toBe("how-to-check-a-plot-before-you-buy-it-in-chennai");
    expect(result.excerpt).toBe(
      "Buying land is a big decision. Here is a short guide to the papers you should ask for.",
    );
    expect(result.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "list",
      "heading",
      "list",
      "quote",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(result.blocks[2]).toEqual({
      type: "list",
      ordered: false,
      items: [
        "The parent document",
        "The latest [encumbrance certificate](https://www.tnreginet.gov.in/portal)",
        "Patta and chitta",
      ],
    });
    expect(result.blocks[4]).toEqual({
      type: "list",
      ordered: true,
      items: ["Visit the sub-registrar's office", "Check the survey number", "Pay the fee"],
    });
    expect(result.blocks[5]).toEqual({
      type: "quote",
      text: "Never pay in cash without a receipt.",
      cite: "Asha Rao",
    });
    expect(result.errors).toEqual([]);
    expect(accepted(result)).toBe(true);
  });

  it("keeps the hashtag line as a paragraph (a hash with no space is text, not a heading)", () => {
    const result = convertMarkdown(ARTICLE);
    expect(result.blocks[result.blocks.length - 1]).toEqual({
      type: "paragraph",
      text: "#realestate #chennai #plots",
    });
  });

  it("warns once about all the formatting it took off, and about the table", () => {
    const result = convertMarkdown(ARTICLE);
    expect(codes(result).filter((code) => code === "formatting")).toHaveLength(1);
    expect(result.warnings.find((warning) => warning.code === "formatting")?.count).toBe(2);
    expect(result.warnings).toContainEqual({ code: "table", line: 20 });
  });

  it("turns each table row into one plain paragraph of its cells", () => {
    const result = convertMarkdown(ARTICLE);
    expect(result.blocks).toContainEqual({ type: "paragraph", text: "Paper · Where" });
    expect(result.blocks).toContainEqual({ type: "paragraph", text: "EC · Sub-registrar" });
  });
});

describe("convertMarkdown: headings", () => {
  it("makes the first # line the title and not a block", () => {
    const result = convertMarkdown("# My title\n\nText.");
    expect(result.title).toBe("My title");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Text." }]);
  });

  it("makes a later # line a level 2 heading with a warning that names the line", () => {
    const result = convertMarkdown("# First\n\nText\n\n# Second");
    expect(result.blocks[1]).toEqual({ type: "heading", level: 2, text: "Second" });
    expect(result.warnings).toContainEqual({ code: "titleLater", line: 5 });
  });

  it("maps ## to 2 and ### to 6 hashes to 3, warning when deeper than 3", () => {
    const result = convertMarkdown("## a\n\n### b\n\n#### c\n\n###### d");
    expect(result.blocks).toEqual([
      { type: "heading", level: 2, text: "a" },
      { type: "heading", level: 3, text: "b" },
      { type: "heading", level: 3, text: "c" },
      { type: "heading", level: 3, text: "d" },
    ]);
    expect(result.warnings.filter((warning) => warning.code === "headingDeep")).toEqual([
      { code: "headingDeep", line: 5, count: 4 },
      { code: "headingDeep", line: 7, count: 6 },
    ]);
  });

  it("needs a space after the hashes", () => {
    for (const text of ["#realestate", "##chennai", "#1 pick"]) {
      const result = convertMarkdown(text);
      expect(result.title).toBe("");
      expect(result.blocks).toEqual([{ type: "paragraph", text }]);
    }
    expect(convertMarkdown("#\t Tab title").title).toBe("Tab title");
  });

  it("drops closing hashes and empty headings", () => {
    const result = convertMarkdown("## Closed ##\n\n##\n\nText");
    expect(result.blocks).toEqual([
      { type: "heading", level: 2, text: "Closed" },
      { type: "paragraph", text: "Text" },
    ]);
  });

  it("never keeps a link in a heading: the label stays", () => {
    const result = convertMarkdown("## See [the guide](https://example.com/g) now");
    expect(result.blocks).toEqual([{ type: "heading", level: 2, text: "See the guide now" }]);
    expect(codes(result)).toContain("headingLink");
  });

  it("refuses a heading over 160 characters and names its line", () => {
    const result = convertMarkdown(`Text\n\n## ${"w".repeat(161)}\n\nMore`);
    expect(result.errors).toEqual([{ code: "headingTooLong", line: 3, count: 161 }]);
    expect(result.blocks.some((block) => block.type === "heading")).toBe(false);
  });

  it("refuses a title over 160 characters the same way", () => {
    const result = convertMarkdown(`# ${"w".repeat(170)}`);
    expect(result.errors[0]).toMatchObject({ code: "headingTooLong", line: 1 });
  });
});

describe("convertMarkdown: paragraphs, lists and quotes", () => {
  it("joins the lines of a paragraph and splits paragraphs at blank lines", () => {
    const result = convertMarkdown("one\ntwo  \nthree\n\nfour");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "one two three" },
      { type: "paragraph", text: "four" },
    ]);
  });

  it("reads -, * and + bullets and 1. and 1) numbers", () => {
    const result = convertMarkdown("- a\n- b\n\n* c\n* d\n\n+ e\n\n1. f\n2. g\n\n1) h\n2) i");
    expect(result.blocks).toEqual([
      { type: "list", ordered: false, items: ["a", "b", "c", "d", "e"] },
      { type: "list", ordered: true, items: ["f", "g", "h", "i"] },
    ]);
  });

  it("starts a new list when bullets turn into numbers", () => {
    const result = convertMarkdown("- a\n1. b");
    expect(result.blocks).toEqual([
      { type: "list", ordered: false, items: ["a"] },
      { type: "list", ordered: true, items: ["b"] },
    ]);
  });

  it("flattens a nested list and warns with how many items moved", () => {
    const result = convertMarkdown("- a\n  - a1\n  - a2\n- b");
    expect(result.blocks).toEqual([
      { type: "list", ordered: false, items: ["a", "a1", "a2", "b"] },
    ]);
    expect(result.warnings).toContainEqual({ code: "nestedList", line: 1, count: 2 });
  });

  it("joins a lazy continuation line to its item", () => {
    const result = convertMarkdown("- first part\n  second part\n- next");
    expect(result.blocks).toEqual([
      { type: "list", ordered: false, items: ["first part second part", "next"] },
    ]);
  });

  it("does not start a bullet from bold text at the start of a line", () => {
    const result = convertMarkdown("**Note:** read this");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Note: read this" }]);
  });

  it("makes a quote of > lines and a last — line its credit", () => {
    const result = convertMarkdown("> Good land is rare.\n>\n> Buy it early.\n> — Ravi K");
    expect(result.blocks).toEqual([
      { type: "quote", text: "Good land is rare. Buy it early.", cite: "Ravi K" },
    ]);
  });

  it("keeps a quote with only a dash line as text (no credit without a quote)", () => {
    const result = convertMarkdown("> — Ravi K");
    expect(result.blocks).toEqual([{ type: "quote", text: "— Ravi K" }]);
  });

  it("reads -- as a credit marker too, and ignores nested > marks", () => {
    const result = convertMarkdown("> > Deep words\n> -- Someone");
    expect(result.blocks).toEqual([{ type: "quote", text: "Deep words", cite: "Someone" }]);
  });

  it("drops horizontal rules and says how many", () => {
    const result = convertMarkdown("a\n\n---\n\nb\n\n***\n\nc\n\n* * *");
    expect(result.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(result.warnings).toContainEqual({ code: "rule", line: null, count: 3 });
  });
});

describe("convertMarkdown: links (ADR-169 rules)", () => {
  it("keeps an https link and a link to a page of this site", () => {
    const result = convertMarkdown("See [a](https://example.com/x?y=1) and [b](/properties).");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "See [a](https://example.com/x?y=1) and [b](/properties)." },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("drops the title part of a link", () => {
    const result = convertMarkdown('Go [here](https://example.com/p "A title") now');
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "Go [here](https://example.com/p) now" },
    ]);
  });

  it("leaves only the label of a refused address, with a warning that names the address", () => {
    const text =
      "[a](http://example.com) [b](javascript:alert(1)) [c](mailto:x@y.example) [d](#top) [e](//evil.example) [f](page.html)";
    const result = convertMarkdown(text);
    const block = result.blocks[0];
    expect(block?.type === "paragraph" ? block.text : "").not.toContain("](");
    expect(result.warnings.filter((warning) => warning.code === "linkDropped")).toHaveLength(6);
    expect(result.warnings[0]).toEqual({
      code: "linkDropped",
      line: 1,
      detail: "http://example.com",
    });
    expect(accepted(result)).toBe(true);
  });

  it("leaves only the label of a link whose label is not allowed", () => {
    const result = convertMarkdown("[a (b)](https://example.com) and [](https://example.com)");
    expect(accepted(result)).toBe(true);
    expect(codes(result)).toEqual(["linkDropped", "linkDropped"]);
  });

  it("does not read formatting characters inside an address", () => {
    const result = convertMarkdown("A [link](https://example.com/a_b_c*d*) here");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "A [link](https://example.com/a_b_c*d*) here" },
    ]);
  });

  it("strips formatting inside a label", () => {
    const result = convertMarkdown("[**bold** words](https://example.com/x)");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "[bold words](https://example.com/x)" },
    ]);
  });

  it("makes a link in a list item and in a quote work too", () => {
    const result = convertMarkdown("- [a](/b)\n\n> see [c](https://d.example)");
    expect(result.blocks).toEqual([
      { type: "list", ordered: false, items: ["[a](/b)"] },
      { type: "quote", text: "see [c](https://d.example)" },
    ]);
  });

  it("never leaves link-shaped text that the schema would refuse", () => {
    for (const text of [
      "[[a](x)](y)",
      "[a][b](c)",
      "text [x] (y) more",
      "[x](y",
      "![img](https://example.com/i.png) [x](/ok)",
      "[a [b](https://e.example)",
      "\\[a\\](b)",
      "[a](https://example.com/" + "z".repeat(2100) + ")",
    ]) {
      const result = convertMarkdown(text);
      expect(accepted(result), text).toBe(true);
    }
  });
});

describe("convertMarkdown: things the article format does not have", () => {
  it("strips bold, italic, strike and code markers and warns ONCE with the count", () => {
    const result = convertMarkdown("A **b** and *i* and __c__ and _d_ and ~~e~~ and `f`.");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "A b and i and c and d and e and f." },
    ]);
    expect(result.warnings).toEqual([{ code: "formatting", line: null, count: 6 }]);
  });

  it("leaves underscores in words and stars with spaces alone", () => {
    const result = convertMarkdown("snake_case_name and 5 * 3 = 15");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "snake_case_name and 5 * 3 = 15" }]);
    expect(result.warnings).toEqual([]);
  });

  it("reads a backslash before a mark as the plain mark", () => {
    const result = convertMarkdown("\\*not bold\\* and \\# not a heading");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "*not bold* and # not a heading" }]);
    expect(result.warnings).toEqual([]);
  });

  it("keeps fenced code as ONE plain paragraph and says the code formatting is lost", () => {
    const result = convertMarkdown("Before\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\nAfter");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "Before" },
      { type: "paragraph", text: "const a = 1; const b = 2;" },
      { type: "paragraph", text: "After" },
    ]);
    expect(result.warnings).toEqual([{ code: "codeBlock", line: 3 }]);
  });

  it("keeps an unclosed fence to the end of the text", () => {
    const result = convertMarkdown("```\nline one\nline two");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "line one line two" }]);
    expect(codes(result)).toEqual(["codeBlock"]);
  });

  it("does not read headings or lists inside a fence", () => {
    const result = convertMarkdown("~~~\n# not a title\n- not a list\n~~~");
    expect(result.title).toBe("");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "# not a title - not a list" }]);
  });

  it("turns an image into its description as words and warns with what was lost", () => {
    const result = convertMarkdown("![Front view of the plot](https://example.com/p.png)");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Front view of the plot" }]);
    expect(result.warnings).toEqual([{ code: "image", line: 1, detail: "Front view of the plot" }]);
  });

  it("drops an image with no description and still warns", () => {
    const result = convertMarkdown("![](https://example.com/p.png)");
    expect(result.blocks).toEqual([]);
    expect(codes(result)).toEqual(["image"]);
  });

  it("takes raw HTML tags off, keeps the words, drops script and comments", () => {
    const result = convertMarkdown(
      "<div class='x'>Hello <b>world</b></div>\n\n<script>alert(1)</script>\n\nA<!-- hidden --> B",
    );
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "Hello world" },
      { type: "paragraph", text: "A B" },
    ]);
    expect(codes(result).filter((code) => code === "html")).toHaveLength(3);
  });

  it("keeps a plain angle-bracket address as text", () => {
    const result = convertMarkdown("Visit <https://example.com> today");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Visit https://example.com today" }]);
  });

  it("keeps a bare address as text, not as a link", () => {
    const result = convertMarkdown("Visit https://example.com/x today");
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "Visit https://example.com/x today" },
    ]);
  });
});

describe("convertMarkdown: limits", () => {
  it("splits a paragraph over 5,000 characters at sentence ends and warns", () => {
    const sentence = "This is one sentence of the article. ";
    const result = convertMarkdown(sentence.repeat(200));
    expect(result.blocks.length).toBeGreaterThan(1);
    for (const block of result.blocks) {
      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.text.length).toBeLessThanOrEqual(5000);
        expect(block.text.endsWith(".")).toBe(true);
      }
    }
    expect(result.warnings).toContainEqual({
      code: "split",
      line: 1,
      detail: "paragraph",
      count: result.blocks.length,
    });
    expect(accepted(result)).toBe(true);
  });

  it("never cuts inside a link when it splits", () => {
    const filler = "word ".repeat(990);
    const result = convertMarkdown(
      `${filler}[a long label of words](https://example.com/x) ${filler}`,
    );
    expect(accepted(result)).toBe(true);
    const joined = result.blocks
      .map((block) => (block.type === "paragraph" ? block.text : ""))
      .join(" ");
    expect(joined).toContain("[a long label of words](https://example.com/x)");
  });

  it("splits one very long word with no spaces", () => {
    const result = convertMarkdown("x".repeat(12_000));
    expect(result.blocks).toHaveLength(3);
    expect(accepted(result)).toBe(true);
  });

  it("splits a list over 50 items into lists of at most 50", () => {
    const items = Array.from({ length: 120 }, (_, number) => `- item ${number}`).join("\n");
    const result = convertMarkdown(items);
    expect(result.blocks.map((block) => (block.type === "list" ? block.items.length : 0))).toEqual([
      50, 50, 20,
    ]);
    expect(result.warnings).toContainEqual({ code: "split", line: 1, detail: "list", count: 3 });
  });

  it("splits a list item over 500 characters into items", () => {
    const result = convertMarkdown(`- ${"Short sentence here. ".repeat(60)}`);
    expect(accepted(result)).toBe(true);
    expect(codes(result)).toContain("split");
  });

  it("splits a quote over 1,000 characters and puts the credit on the last piece", () => {
    const result = convertMarkdown(`> ${"A quoted sentence. ".repeat(80)}\n> — Someone`);
    expect(accepted(result)).toBe(true);
    const quotes = result.blocks.filter((block) => block.type === "quote");
    expect(quotes.length).toBeGreaterThan(1);
    expect(quotes[quotes.length - 1]).toHaveProperty("cite", "Someone");
    expect(quotes[0]).not.toHaveProperty("cite");
  });

  it("errors on more than 100 blocks and says how many", () => {
    const result = convertMarkdown(
      Array.from({ length: 101 }, (_, number) => `Paragraph ${number}`).join("\n\n"),
    );
    expect(result.errors).toEqual([{ code: "tooManyBlocks", line: null, count: 101 }]);
  });

  it("accepts exactly 100 blocks", () => {
    const result = convertMarkdown(
      Array.from({ length: 100 }, (_, number) => `Paragraph ${number}`).join("\n\n"),
    );
    expect(result.errors).toEqual([]);
    expect(accepted(result)).toBe(true);
  });

  it("errors on a body over 100,000 bytes", () => {
    const paragraph = "é".repeat(4000);
    const result = convertMarkdown(Array.from({ length: 20 }, () => paragraph).join("\n\n"));
    expect(result.errors.map((error) => error.code)).toEqual(["tooBig"]);
  });

  it("errors on text over the input limit without reading it", () => {
    const result = convertMarkdown("a".repeat(MARKDOWN_MAX_CHARS + 1));
    expect(result.errors).toEqual([{ code: "inputTooBig", line: null, count: MARKDOWN_MAX_CHARS }]);
    expect(result.blocks).toEqual([]);
  });

  it("converts a 50,000 character paste quickly", () => {
    const text = Array.from(
      { length: 400 },
      (_, number) =>
        `## Part ${number}\n\nSome words with **bold** and a [link](https://example.com/${number}). More words follow here.\n\n- one\n- two`,
    ).join("\n\n");
    expect(text.length).toBeGreaterThan(40_000);
    const started = performance.now();
    convertMarkdown(text);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe("convertMarkdown: empty input, address and excerpt", () => {
  it("gives nothing for empty or blank text", () => {
    for (const text of ["", "   ", "\n\n\t\n"]) {
      expect(convertMarkdown(text)).toEqual({
        blocks: [],
        title: "",
        slug: "",
        excerpt: "",
        warnings: [],
        errors: [],
      });
    }
  });

  it("reads Windows line endings and a byte order mark", () => {
    const result = convertMarkdown("﻿# Title\r\n\r\nText\r\nmore");
    expect(result.title).toBe("Title");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Text more" }]);
  });

  it("cuts the excerpt to 320 characters at a word, with no link syntax", () => {
    const result = convertMarkdown(`[Read this](https://example.com/x) ${"word ".repeat(100)}`);
    expect(result.excerpt.length).toBeLessThanOrEqual(320);
    expect(result.excerpt.endsWith("…")).toBe(true);
    expect(result.excerpt).not.toContain("](");
    expect(result.excerpt.startsWith("Read this word")).toBe(true);
  });

  it("makes the excerpt from the first paragraph, not a heading or a list", () => {
    const result = convertMarkdown("## Heading\n\n- item\n\nThe first paragraph.\n\nSecond.");
    expect(result.excerpt).toBe("The first paragraph.");
  });

  it("makes an address from the title with accents dropped", () => {
    expect(convertMarkdown("# Café & Plots: 2026!").slug).toBe("cafe-plots-2026");
  });
});

describe("convertMarkdown: whatever is pasted, the blocks pass the article's schema", () => {
  const PIECES = [
    "# Title",
    "## Heading",
    "### Sub",
    "####### seven",
    "text with [link](https://example.com/a) here",
    "[bad](http://x.example)",
    "- item",
    "  - nested",
    "1. one",
    "> quote",
    "> — cite",
    "---",
    "```",
    "~~~",
    "| a | b |",
    "|---|---|",
    "**bold** _it_ `code` ~~gone~~",
    "![alt](https://example.com/i.png)",
    "<div>html</div>",
    "<!-- c -->",
    "[[nested]](x)",
    "\\[escaped\\](y)",
    "[a](",
    "](",
    "#tag",
    "",
    "",
    "   ",
    "\t- tabbed",
    "* * *",
    "plain words",
  ];

  it("holds for 400 generated pastes", () => {
    // A small seeded generator, so a failure repeats.
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let run = 0; run < 400; run += 1) {
      const lines = Array.from(
        { length: 1 + Math.floor(next() * 25) },
        () => PIECES[Math.floor(next() * PIECES.length)] ?? "",
      );
      const text = lines.join(next() < 0.5 ? "\n" : "\n\n");
      const result = convertMarkdown(text);
      if (result.errors.length === 0) expect(accepted(result), text).toBe(true);
    }
  });
});
