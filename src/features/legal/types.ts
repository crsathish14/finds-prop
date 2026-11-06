/** The three legal pages share one reading layout (ADD-12). */
export const LEGAL_KINDS = ["privacy", "terms", "cookies"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

/** Where each page lives. */
export const LEGAL_PATHS: Record<LegalKind, string> = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
};

/** One piece of a section: a paragraph, a list, or a table (what we collect, which cookies). */
export type LegalBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: readonly string[] }
  | {
      type: "table";
      caption: string;
      head: readonly string[];
      rows: readonly (readonly string[])[];
    };

export type LegalSection = {
  /** The anchor the contents list links to: lower case words joined by hyphens, unique on the page. */
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
};

/**
 * One legal page's text. The owner writes the final text (DEC-25); until then `draft` is true, the page
 * says so on its face and is kept out of search results. Set `draft` to false, with `updated` and
 * `version`, when the final text is in.
 */
export type LegalDocument = {
  kind: LegalKind;
  draft: boolean;
  /** The date the text was last changed, as a day (`YYYY-MM-DD`), or null for a draft. */
  updated: string | null;
  /** The version of the text, or null for a draft. */
  version: string | null;
  summary: string;
  sections: readonly LegalSection[];
};
