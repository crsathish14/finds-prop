import { z } from "zod";
import {
  EDITABLE_LEGAL_KINDS,
  LEGAL_BLOCKS_MAX,
  LEGAL_HEADING_MAX,
  LEGAL_LIST_ITEM_MAX,
  LEGAL_LIST_ITEMS_MAX,
  LEGAL_PARAGRAPH_MAX,
  LEGAL_SECTION_ID_MAX,
  LEGAL_SECTIONS_MAX,
  LEGAL_SUMMARY_MAX,
  LEGAL_TABLE_CAPTION_MAX,
  LEGAL_TABLE_CELL_MAX,
  LEGAL_TABLE_COLUMNS_MAX,
  LEGAL_TABLE_ROWS_MAX,
} from "./constants";

/**
 * What the legal editor sends and what a page's row in `site_settings` holds (ADR-151). A schema message is a key
 * under `validation.*`; the screen looks the words up (ADR-035). The text is plain: it is shown as text, never as
 * markup, so no control characters are accepted and nothing is interpreted.
 */
const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "validation.required", abort: true })
    .max(max)
    .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" });

const paragraphBlock = z.object({ type: z.literal("paragraph"), text: line(LEGAL_PARAGRAPH_MAX) });

const listBlock = z.object({
  type: z.literal("list"),
  items: z.array(line(LEGAL_LIST_ITEM_MAX)).min(1).max(LEGAL_LIST_ITEMS_MAX),
});

const tableBlock = z
  .object({
    type: z.literal("table"),
    caption: line(LEGAL_TABLE_CAPTION_MAX),
    head: z.array(line(LEGAL_TABLE_CELL_MAX)).min(1).max(LEGAL_TABLE_COLUMNS_MAX),
    rows: z
      .array(z.array(line(LEGAL_TABLE_CELL_MAX)).min(1).max(LEGAL_TABLE_COLUMNS_MAX))
      .min(1)
      .max(LEGAL_TABLE_ROWS_MAX),
  })
  .superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.head.length) {
        context.addIssue({ code: "custom", message: "validation.invalid", path: ["rows", index] });
      }
    });
  });

const blockSchema = z.discriminatedUnion("type", [paragraphBlock, listBlock, tableBlock]);

const sectionSchema = z.object({
  /** The anchor the contents list links to: lower case words joined by hyphens. */
  id: z
    .string()
    .max(LEGAL_SECTION_ID_MAX)
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, { error: "validation.invalid" }),
  heading: line(LEGAL_HEADING_MAX),
  blocks: z.array(blockSchema).min(1).max(LEGAL_BLOCKS_MAX),
});

/** The sections, in order. Two sections must never share an anchor: the contents list would jump to the wrong one. */
const sectionsSchema = z
  .array(sectionSchema)
  .min(1)
  .max(LEGAL_SECTIONS_MAX)
  .superRefine((sections, context) => {
    const seen = new Set<string>();
    sections.forEach((section, index) => {
      if (seen.has(section.id)) {
        context.addIssue({ code: "custom", message: "validation.invalid", path: [index, "id"] });
      }
      seen.add(section.id);
    });
  });

/** One save from the editor: the text, and whether it goes live now (`publish`) or is kept as a working copy. */
export const legalInputSchema = z.object({
  kind: z.enum(EDITABLE_LEGAL_KINDS, { error: "validation.invalid" }),
  summary: line(LEGAL_SUMMARY_MAX),
  sections: sectionsSchema,
  publish: z.boolean({ error: "validation.invalid" }),
});
export type LegalInput = z.infer<typeof legalInputSchema>;

/** One stored version of a page. */
export const storedDocumentSchema = z.object({
  draft: z.boolean(),
  updated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  version: z.string().max(20).nullable(),
  summary: z.string().max(LEGAL_SUMMARY_MAX),
  sections: sectionsSchema,
});
export type StoredDocument = z.infer<typeof storedDocumentSchema>;

/** A page's row: the version visitors read, and the working copy the admin is still editing. Either may be absent. */
export const legalRowSchema = z.object({
  published: storedDocumentSchema.optional(),
  working: storedDocumentSchema.optional(),
});
export type LegalRow = z.infer<typeof legalRowSchema>;
