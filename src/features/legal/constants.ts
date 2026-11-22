import type { LegalKind } from "./types";

/**
 * The legal pages the admin may edit (ADR-151). The cookie page stays in code: its table must list exactly what the
 * code stores (ADR-053), so editing it in a screen could make it say something untrue.
 */
export const EDITABLE_LEGAL_KINDS = ["privacy", "terms"] as const satisfies readonly LegalKind[];
export type EditableLegalKind = (typeof EDITABLE_LEGAL_KINDS)[number];

/** The `site_settings` row that holds each editable page (the key rule allows lower case words and underscores). */
export const LEGAL_SETTING_KEYS = {
  privacy: "legal_privacy",
  terms: "legal_terms",
} as const satisfies Record<EditableLegalKind, string>;

/** How much a page may hold. Generous for real policies, small enough that one row stays well under a megabyte. */
export const LEGAL_SUMMARY_MAX = 600;
export const LEGAL_SECTIONS_MAX = 30;
export const LEGAL_HEADING_MAX = 120;
export const LEGAL_SECTION_ID_MAX = 60;
export const LEGAL_BLOCKS_MAX = 40;
export const LEGAL_PARAGRAPH_MAX = 4000;
export const LEGAL_LIST_ITEMS_MAX = 40;
export const LEGAL_LIST_ITEM_MAX = 1000;
export const LEGAL_TABLE_CAPTION_MAX = 160;
export const LEGAL_TABLE_COLUMNS_MAX = 6;
export const LEGAL_TABLE_ROWS_MAX = 60;
export const LEGAL_TABLE_CELL_MAX = 500;
