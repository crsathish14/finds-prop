import { COOKIES } from "./content/cookies";
import { PRIVACY } from "./content/privacy";
import { TERMS } from "./content/terms";
import type { LegalDocument, LegalKind, LegalSection } from "./types";

const DOCUMENTS: Record<LegalKind, LegalDocument> = {
  privacy: PRIVACY,
  terms: TERMS,
  cookies: COOKIES,
};

/** One legal page's text. */
export function legalDocument(kind: LegalKind): LegalDocument {
  return DOCUMENTS[kind];
}

/** One entry of the "On this page" list: the number, the heading and the anchor of a section. */
export type ContentsEntry = { id: string; number: number; heading: string };

/** The contents list of a page: its sections in order, numbered from 1, each with its anchor. */
export function contentsOf(sections: readonly LegalSection[]): ContentsEntry[] {
  return sections.map((section, index) => ({
    id: section.id,
    number: index + 1,
    heading: section.heading,
  }));
}
