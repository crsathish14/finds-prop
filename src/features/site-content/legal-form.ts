import type {
  LegalDocumentErrors,
  LegalDocumentValues,
} from "@/components/domain/legal-document-fields";

/** The legal pages the admin edits (ADR-151); a test keeps this the same as the legal feature's own list. */
export type LegalEditorKind = "privacy" | "terms";

/** The longest section anchor; a test keeps it the same as the legal feature's limit. */
export const LEGAL_ANCHOR_MAX = 60;

/** How much the boxes let a page hold; a test keeps these the same as the legal feature's limits. */
export const LEGAL_EDITOR_LIMITS = { sections: 30, blocks: 40, rows: 60, columns: 6 } as const;

/** A page's text as the editor receives it (the legal feature's `LegalDocument` has this shape). */
export interface LegalPageText {
  summary: string;
  sections: readonly {
    heading: string;
    blocks: readonly (
      | { type: "paragraph"; text: string }
      | { type: "list"; items: readonly string[] }
      | {
          type: "table";
          caption: string;
          head: readonly string[];
          rows: readonly (readonly string[])[];
        }
    )[];
  }[];
}

/**
 * What the legal editor does with the values, apart from the screen so it can be tested on its own (ADR-151, part C):
 * where the boxes start, the payload a save sends (with the section anchors made from the headings), and the server's
 * problems put on the boxes they belong to. Pure: no server code, so a client island may import it.
 */

/** Problems by the field path the server uses (`sections.2.blocks.0.text`), already in words. */
export type LegalProblems = Readonly<Record<string, string>>;

/**
 * The boxes' first values from a page's text. The ids are only the editor's own handles (never shown, never saved), and
 * they are numbered, not random, so the page the server draws and the page the browser draws agree.
 */
export function valuesOf(document: LegalPageText): LegalDocumentValues {
  return {
    summary: document.summary,
    sections: document.sections.map((section, sectionIndex) => ({
      id: `s-${sectionIndex + 1}`,
      heading: section.heading,
      blocks: section.blocks.map((block, blockIndex) => {
        const id = `b-${sectionIndex + 1}-${blockIndex + 1}`;
        if (block.type === "paragraph") return { id, type: "paragraph" as const, text: block.text };
        if (block.type === "list")
          return { id, type: "list" as const, items: block.items.join("\n") };
        return {
          id,
          type: "table" as const,
          caption: block.caption,
          head: [...block.head],
          rows: block.rows.map((row) => [...row]),
        };
      }),
    })),
  };
}

/**
 * The anchor of a section: its heading as lower case words joined by hyphens (accents dropped), starting with a letter,
 * and not the same as an anchor already taken, so the contents list never jumps to the wrong section.
 */
export function anchorOf(heading: string, place: number, taken: ReadonlySet<string>): string {
  const words = heading
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = (/^[a-z]/.test(words) ? words : `section-${place}${words ? `-${words}` : ""}`)
    .slice(0, LEGAL_ANCHOR_MAX - 4)
    .replace(/-+$/g, "");
  let id = base;
  for (let attempt = 2; taken.has(id); attempt += 1) id = `${base}-${attempt}`;
  return id;
}

/** The payload a save sends. A list is one item per line (blank lines dropped); every section gets its anchor here. */
export function payloadOf(
  kind: LegalEditorKind,
  values: LegalDocumentValues,
  publish: boolean,
): Record<string, unknown> {
  const taken = new Set<string>();
  return {
    kind,
    publish,
    summary: values.summary,
    sections: values.sections.map((section, index) => {
      const id = anchorOf(section.heading, index + 1, taken);
      taken.add(id);
      return {
        id,
        heading: section.heading,
        blocks: section.blocks.map((block) => {
          if (block.type === "paragraph") return { type: "paragraph", text: block.text };
          if (block.type === "list") {
            return {
              type: "list",
              items: block.items
                .split("\n")
                .map((item) => item.trim())
                .filter((item) => item !== ""),
            };
          }
          return { type: "table", caption: block.caption, head: block.head, rows: block.rows };
        }),
      };
    }),
  };
}

/** True when nothing differs from what the boxes started with. */
export function sameValues(first: LegalDocumentValues, second: LegalDocumentValues): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * The server's problems on the boxes they belong to. A path names a section and a block by their place in the list, and
 * the editor's boxes are keyed by the editor's own ids, so the place is turned into the id here. A problem with no box
 * of its own (a page with no sections, a section with no blocks) is shown above the sections.
 */
export function problemsOf(
  values: LegalDocumentValues,
  problems: LegalProblems,
): LegalDocumentErrors {
  const found: Record<string, string> = {};
  const put = (key: string, message: string) => {
    found[key] ??= message;
  };
  for (const [path, message] of Object.entries(problems)) {
    const parts = path.split(".");
    if (parts[0] === "summary") {
      put("summary", message);
      continue;
    }
    if (parts[0] !== "sections") {
      put("sections", message);
      continue;
    }
    const section = parts[1] === undefined ? undefined : values.sections[Number(parts[1])];
    if (!section) {
      put("sections", message);
      continue;
    }
    if (parts[2] === undefined || parts[2] === "id" || parts[2] === "heading") {
      put(`${section.id}:heading`, message);
      continue;
    }
    const block = parts[3] === undefined ? undefined : section.blocks[Number(parts[3])];
    if (parts[2] !== "blocks" || !block) {
      put(`${section.id}:blocks`, message);
      continue;
    }
    const part = parts[4];
    if (part === "text") put(`${block.id}:text`, message);
    else if (part === "items") put(`${block.id}:items`, message);
    else if (part === "caption") put(`${block.id}:caption`, message);
    else put(`${block.id}:table`, message);
  }
  return found;
}
