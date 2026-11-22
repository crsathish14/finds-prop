import { describe, expect, it } from "vitest";
import { legalInputSchema, legalRowSchema } from "../schemas";

const paragraph = { type: "paragraph", text: "Some text." };
const section = (id: string) => ({ id, heading: `Heading ${id}`, blocks: [paragraph] });
const valid = {
  kind: "privacy",
  summary: "A short summary.",
  sections: [section("one"), section("two-parts")],
  publish: false,
};

describe("UT-legal-schemas: what the legal editor may send (ADR-151)", () => {
  it("accepts paragraphs, lists and tables", () => {
    const parsed = legalInputSchema.safeParse({
      ...valid,
      sections: [
        {
          id: "what-we-collect",
          heading: "What we collect",
          blocks: [
            paragraph,
            { type: "list", items: ["Your phone number", "Your enquiries"] },
            {
              type: "table",
              caption: "What is collected",
              head: ["What", "Why"],
              rows: [["Phone", "Sign-in"]],
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("trims the text it keeps", () => {
    const parsed = legalInputSchema.parse({ ...valid, summary: "  Spaced out.  " });
    expect(parsed.summary).toBe("Spaced out.");
  });

  it("accepts the privacy and terms pages and refuses the cookie page and any other", () => {
    expect(legalInputSchema.safeParse({ ...valid, kind: "terms" }).success).toBe(true);
    expect(legalInputSchema.safeParse({ ...valid, kind: "cookies" }).success).toBe(false);
    expect(legalInputSchema.safeParse({ ...valid, kind: "about" }).success).toBe(false);
  });

  it("refuses two sections with the same anchor, naming the second", () => {
    const parsed = legalInputSchema.safeParse({
      ...valid,
      sections: [section("same"), section("same")],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["sections", 1, "id"]);
  });

  it.each([
    "Upper",
    "has space",
    "-leading",
    "trailing-",
    "double--hyphen",
    "1starts-with-digit",
    "",
  ])("refuses the anchor %j", (id) => {
    expect(legalInputSchema.safeParse({ ...valid, sections: [section(id)] }).success).toBe(false);
  });

  it("refuses a table row with a different number of cells than the header", () => {
    const parsed = legalInputSchema.safeParse({
      ...valid,
      sections: [
        {
          id: "table",
          heading: "Table",
          blocks: [{ type: "table", caption: "C", head: ["A", "B"], rows: [["only one"]] }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["sections", 0, "blocks", 0, "rows", 0]);
  });

  it("refuses empty text, control characters, no sections, and a section with no blocks", () => {
    expect(legalInputSchema.safeParse({ ...valid, summary: "   " }).success).toBe(false);
    expect(
      legalInputSchema.safeParse({
        ...valid,
        sections: [
          { id: "a", heading: "A", blocks: [{ type: "paragraph", text: "bad\u0000text" }] },
        ],
      }).success,
    ).toBe(false);
    expect(legalInputSchema.safeParse({ ...valid, sections: [] }).success).toBe(false);
    expect(
      legalInputSchema.safeParse({ ...valid, sections: [{ id: "a", heading: "A", blocks: [] }] })
        .success,
    ).toBe(false);
  });

  it("refuses a block type it does not know and a missing publish flag", () => {
    expect(
      legalInputSchema.safeParse({
        ...valid,
        sections: [{ id: "a", heading: "A", blocks: [{ type: "html", text: "<b>x</b>" }] }],
      }).success,
    ).toBe(false);
    expect(
      legalInputSchema.safeParse({
        kind: valid.kind,
        summary: valid.summary,
        sections: valid.sections,
      }).success,
    ).toBe(false);
  });

  it("reads a stored row with a published version, a working copy, both or neither", () => {
    const stored = {
      draft: false,
      updated: "2026-11-22",
      version: "1",
      summary: "S",
      sections: [section("a")],
    };
    expect(legalRowSchema.safeParse({}).success).toBe(true);
    expect(legalRowSchema.safeParse({ published: stored }).success).toBe(true);
    expect(
      legalRowSchema.safeParse({ published: stored, working: { ...stored, draft: true } }).success,
    ).toBe(true);
    expect(legalRowSchema.safeParse({ published: { ...stored, updated: "22 Nov" } }).success).toBe(
      false,
    );
  });
});
