import type { Metadata } from "next";
import { NO_INDEX, pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";
import { legalDocument } from "./documents";
import { legalDescription, legalTitle } from "./words";
import { LEGAL_PATHS, type LegalDocument, type LegalKind } from "./types";

/**
 * The title, description and canonical address of a legal page. While the page's text is a placeholder
 * (`draft`), it is kept out of search results (and out of the sitemap), so a draft is never submitted;
 * the page indexes normally once the owner marks the final text in. `document` is the text the page shows (the admin's
 * published text, ADR-151), so a published page indexes and a placeholder does not; with none given it is the text in
 * code.
 */
export function legalMetadata(
  kind: LegalKind,
  translate: Translate,
  document: LegalDocument = legalDocument(kind),
): Metadata {
  const base = pageMetadata({
    title: legalTitle(translate, kind),
    description: legalDescription(translate, kind),
    path: LEGAL_PATHS[kind],
    siteName: translate("meta.title"),
  });
  return document.draft ? { ...base, ...NO_INDEX } : base;
}
