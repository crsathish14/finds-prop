import type { Metadata } from "next";
import { NO_INDEX, pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";
import { legalDocument } from "./documents";
import { legalDescription, legalTitle } from "./words";
import { LEGAL_PATHS, type LegalKind } from "./types";

/**
 * The title, description and canonical address of a legal page. While the page's text is a placeholder
 * (`draft`), it is kept out of search results (and out of the sitemap), so a draft is never submitted;
 * the page indexes normally once the owner marks the final text in.
 */
export function legalMetadata(kind: LegalKind, translate: Translate): Metadata {
  const base = pageMetadata({
    title: legalTitle(translate, kind),
    description: legalDescription(translate, kind),
    path: LEGAL_PATHS[kind],
    siteName: translate("meta.title"),
  });
  return legalDocument(kind).draft ? { ...base, ...NO_INDEX } : base;
}
