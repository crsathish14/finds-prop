import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LINK_PATTERN_SOURCE } from "@/lib/inline-links";
import { blocksToPlainText, excerptFromBlocks, readMinutesOf } from "../body-text";
import { blockSchema, bodySchema, type Block } from "../schemas";
import { parseBody } from "../view";

const IMAGE = "blog/00000000-0000-4000-b500-0000000000a1/living-room.webp";
const paragraph = (text: string) => ({ type: "paragraph", text });

describe("UT-blog-links: inline links in the block format (ADR-169)", () => {
  it("accepts allowed links in a paragraph, a list item and a quote, and keeps them as typed", () => {
    const text = "Read [the guide](https://example.com/a) and [home](/)";
    expect(blockSchema.parse(paragraph(text))).toEqual(paragraph(text));
    expect(
      blockSchema.safeParse({ type: "list", ordered: false, items: ["[a](/b)"] }).success,
    ).toBe(true);
    expect(blockSchema.safeParse({ type: "quote", text: "[a](https://a.example)" }).success).toBe(
      true,
    );
  });

  it.each([
    ["validation.blogLinkAddress", "[x](http://example.com)"],
    ["validation.blogLinkAddress", "[x](javascript:alert(1))"],
    ["validation.blogLinkAddress", "[x](//evil.example)"],
    ["validation.blogLinkAddress", "[note](below)"],
    ["validation.blogLinkLabel", "[](https://example.com)"],
    ["validation.blogLinkLabel", "[a (b)](https://example.com)"],
    ["validation.blogLinkTooLong", `[x](https://example.com/${"a".repeat(2000)})`],
  ])("refuses to save a bad link with %s: %s", (message, text) => {
    for (const block of [
      paragraph(text),
      { type: "list", ordered: true, items: ["fine", text] },
      { type: "quote", text },
    ]) {
      const result = blockSchema.safeParse(block);
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain(message);
    }
  });

  it("does not read a heading, a credit, a caption or a description as links", () => {
    const text = "[x](http://example.com)";
    expect(blockSchema.safeParse({ type: "heading", level: 2, text }).success).toBe(true);
    expect(blockSchema.safeParse({ type: "quote", text: "Hi", cite: text }).success).toBe(true);
    expect(
      blockSchema.safeParse({ type: "image", path: IMAGE, alt: text, caption: text }).success,
    ).toBe(true);
  });

  it("still opens an article saved before links existed that holds link-shaped text", () => {
    const stored = [paragraph("Use [note](below) as a marker.")];
    expect(bodySchema.safeParse(stored).success).toBe(false);
    expect(parseBody(stored as never)).toEqual(stored);
  });

  /** The same vectors are in supabase/tests/blog_inline_links.test.sql: the two functions are one function. */
  it.each([
    ["Read [the guide](https://example.com/a?b=1) now", "Read the guide now"],
    ["Go [home](/) or [search](/properties?city=chennai).", "Go home or search."],
    ["[bad](http://example.com) stays", "[bad](http://example.com) stays"],
    ["[x](//evil.example) stays", "[x](//evil.example) stays"],
    ["[a [b](https://e.example)", "[a b"],
    ["no links [1] and (two)", "no links [1] and (two)"],
  ])("reads %s as %s", (source, expected) => {
    expect(blocksToPlainText([paragraph(source)] as Block[])).toBe(expected);
    expect(blocksToPlainText([{ type: "quote", text: source }])).toBe(expected);
    expect(blocksToPlainText([{ type: "list", ordered: false, items: [source, "end"] }])).toBe(
      `${expected} end`,
    );
  });

  it("leaves the addresses out of the reading time and the excerpt, and leaves a heading alone", () => {
    const body = [paragraph(`Go [here](https://example.com/${"a".repeat(1000)}) now`)] as Block[];
    expect(blocksToPlainText(body)).toBe("Go here now");
    expect(readMinutesOf(body)).toBe(1);
    expect(excerptFromBlocks(body)).toBe("Go here now");
    expect(blocksToPlainText([{ type: "heading", level: 2, text: "[a](https://b.example)" }])).toBe(
      "[a](https://b.example)",
    );
  });
});

describe("UT-blog-links-migration-parity: the database reads links the way the code does", () => {
  const SQL = readFileSync(
    join(process.cwd(), "supabase/migrations/20261124150000_blog_inline_links.sql"),
    "utf8",
  );

  it("strips the same pattern in the search text (a paragraph, a quote and each list item)", () => {
    const replaceCalls = SQL.split(`'${LINK_PATTERN_SOURCE}'`).length - 1;
    expect(replaceCalls).toBe(2);
    expect(SQL).toContain("in ('paragraph', 'quote')");
  });

  it("refuses link-shaped text that is not allowed, with the same limits as the form", () => {
    expect(SQL).toContain("char_length(link.part[2]) <= 2000");
    expect(SQL).toContain("{0,159}$'");
    // One check in a paragraph, one in a quote and one in a list item.
    expect(SQL.split("select 1 from regexp_matches(").length - 1).toBe(3);
    expect(SQL).toContain("^https://[a-zA-Z0-9-]+");
  });

  it("does not touch a heading's text, a quote's credit, a caption or a description", () => {
    expect(SQL).toContain("else block.block_value ->> 'text' end as piece");
    expect(SQL).toContain("union all select 1, block.block_value ->> 'cite'");
  });
});

describe("UT-blog-links-no-html: nothing here draws HTML", () => {
  it.each([
    "src/lib/inline-links.ts",
    "src/components/domain/blog-blocks.tsx",
    "src/components/domain/blog-link-text-field.tsx",
    "src/components/domain/blog-block-editor.tsx",
  ])("%s never sets innerHTML", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("innerHTML");
  });
});
