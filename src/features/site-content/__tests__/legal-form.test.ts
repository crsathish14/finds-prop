import { describe, expect, it } from "vitest";
import {
  EDITABLE_LEGAL_KINDS,
  LEGAL_BLOCKS_MAX,
  LEGAL_SECTION_ID_MAX,
  LEGAL_SECTIONS_MAX,
  LEGAL_TABLE_COLUMNS_MAX,
  LEGAL_TABLE_ROWS_MAX,
} from "@/features/legal/constants";
import { legalDocument } from "@/features/legal/documents";
import { legalInputSchema } from "@/features/legal/schemas";
import {
  LEGAL_ANCHOR_MAX,
  LEGAL_EDITOR_LIMITS,
  anchorOf,
  payloadOf,
  problemsOf,
  sameValues,
  valuesOf,
} from "../legal-form";

describe("UT-legal-form: the editor's own copies of the legal feature's rules (ADR-151)", () => {
  it("keep the same limits and the same editable pages", () => {
    expect(LEGAL_ANCHOR_MAX).toBe(LEGAL_SECTION_ID_MAX);
    expect(LEGAL_EDITOR_LIMITS).toEqual({
      sections: LEGAL_SECTIONS_MAX,
      blocks: LEGAL_BLOCKS_MAX,
      rows: LEGAL_TABLE_ROWS_MAX,
      columns: LEGAL_TABLE_COLUMNS_MAX,
    });
    expect([...EDITABLE_LEGAL_KINDS]).toEqual(["privacy", "terms"]);
  });
});

describe("UT-legal-form: the boxes' first values", () => {
  it("numbers the sections and blocks and joins a list into one line per item", () => {
    const values = valuesOf({
      summary: "Short.",
      sections: [
        {
          heading: "Who we are",
          blocks: [
            { type: "paragraph", text: "Hello." },
            { type: "list", items: ["One", "Two"] },
            { type: "table", caption: "Cap", head: ["A", "B"], rows: [["1", "2"]] },
          ],
        },
        { heading: "Second", blocks: [{ type: "paragraph", text: "More." }] },
      ],
    });
    expect(values.sections.map((section) => section.id)).toEqual(["s-1", "s-2"]);
    expect(values.sections[0]?.blocks.map((block) => block.id)).toEqual([
      "b-1-1",
      "b-1-2",
      "b-1-3",
    ]);
    expect(values.sections[0]?.blocks[1]).toMatchObject({ type: "list", items: "One\nTwo" });
  });

  it("opens every page the code holds as values the save schema accepts again", () => {
    for (const kind of EDITABLE_LEGAL_KINDS) {
      const document = legalDocument(kind);
      const payload = payloadOf(kind, valuesOf(document), false);
      const parsed = legalInputSchema.safeParse(payload);
      expect(parsed.success, kind).toBe(true);
    }
  });

  it("sees a change", () => {
    const values = valuesOf(legalDocument("privacy"));
    expect(sameValues(values, valuesOf(legalDocument("privacy")))).toBe(true);
    expect(sameValues(values, { ...values, summary: `${values.summary}!` })).toBe(false);
  });
});

describe("UT-legal-form: the anchor of a section", () => {
  const none = new Set<string>();

  it("is the heading as lower case words joined by hyphens, accents dropped", () => {
    expect(anchorOf("What we collect", 1, none)).toBe("what-we-collect");
    expect(anchorOf("  Your Rights & Choices!  ", 1, none)).toBe("your-rights-choices");
    expect(anchorOf("Café policy", 1, none)).toBe("cafe-policy");
  });

  it("starts with a letter, so a numbered or non-Latin heading still has a valid anchor", () => {
    expect(anchorOf("2 Cookies", 3, none)).toBe("section-3-2-cookies");
    expect(anchorOf("தனியுரிமை", 4, none)).toBe("section-4");
    expect(anchorOf("", 2, none)).toBe("section-2");
  });

  it("is never the same as an anchor already taken", () => {
    expect(anchorOf("Cookies", 1, new Set(["cookies"]))).toBe("cookies-2");
    expect(anchorOf("Cookies", 1, new Set(["cookies", "cookies-2"]))).toBe("cookies-3");
  });

  it("stays within the limit and ends on a word", () => {
    const id = anchorOf("a ".repeat(100), 1, none);
    expect(id.length).toBeLessThanOrEqual(LEGAL_SECTION_ID_MAX);
    expect(id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });
});

describe("UT-legal-form: the payload of a save", () => {
  const values = {
    summary: "S",
    sections: [
      {
        id: "x",
        heading: "Cookies",
        blocks: [
          { id: "p", type: "paragraph" as const, text: "Text" },
          { id: "l", type: "list" as const, items: " one \n\n two\n   \n" },
        ],
      },
      {
        id: "y",
        heading: "Cookies",
        blocks: [{ id: "q", type: "paragraph" as const, text: "More" }],
      },
    ],
  };

  it("makes unique anchors, drops blank list lines and says whether it publishes", () => {
    const payload = payloadOf("terms", values, true);
    expect(payload).toMatchObject({ kind: "terms", publish: true, summary: "S" });
    expect(legalInputSchema.safeParse(payload).success).toBe(true);
    const sections = payload["sections"] as { id: string; blocks: unknown[] }[];
    expect(sections.map((section) => section.id)).toEqual(["cookies", "cookies-2"]);
    expect(sections[0]?.blocks[1]).toEqual({ type: "list", items: ["one", "two"] });
    expect(payloadOf("terms", values, false)).toMatchObject({ publish: false });
  });

  it("never sends the editor's own ids", () => {
    expect(JSON.stringify(payloadOf("privacy", values, false))).not.toMatch(/"(x|y|p|l|q)"/);
  });
});

describe("UT-legal-form: the server's problems on their boxes", () => {
  const values = valuesOf({
    summary: "S",
    sections: [
      {
        heading: "One",
        blocks: [
          { type: "paragraph", text: "" },
          { type: "list", items: [] },
          { type: "table", caption: "", head: ["A"], rows: [["1"]] },
        ],
      },
      { heading: "Two", blocks: [] },
    ],
  });

  it("puts each path on the box that holds it", () => {
    expect(
      problemsOf(values, {
        summary: "a",
        "sections.0.heading": "b",
        "sections.0.blocks.0.text": "c",
        "sections.0.blocks.1.items": "d",
        "sections.0.blocks.1.items.2": "ignored: the box already has a problem",
        "sections.0.blocks.2.caption": "e",
        "sections.0.blocks.2.rows.0": "f",
        "sections.0.blocks.2.head.0": "g",
      }),
    ).toEqual({
      summary: "a",
      "s-1:heading": "b",
      "b-1-1:text": "c",
      "b-1-2:items": "d",
      "b-1-3:caption": "e",
      "b-1-3:table": "f",
    });
  });

  it("puts a section with no blocks, a page with no sections and an unknown path above the sections", () => {
    expect(problemsOf(values, { "sections.1.blocks": "none" })).toEqual({ "s-2:blocks": "none" });
    expect(
      problemsOf(values, { sections: "too few", publish: "odd", "sections.9.heading": "gone" }),
    ).toEqual({
      sections: "too few",
    });
  });
});
