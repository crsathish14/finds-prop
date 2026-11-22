import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import { LEGAL_SETTING_KEYS, type EditableLegalKind } from "./constants";
import { legalDocument } from "./documents";
import { rowOf } from "./save-service";
import type { StoredDocument } from "./schemas";
import type { LegalDocument, LegalKind } from "./types";

function documentOf(kind: LegalKind, stored: StoredDocument): LegalDocument {
  return { kind, ...stored };
}

function isEditable(kind: LegalKind): kind is EditableLegalKind {
  return kind === "privacy" || kind === "terms";
}

/**
 * The text of a legal page as visitors read it (ADR-151): the published version the admin saved, or the text in code
 * when there is none, so a page can never come up empty. Public data, so it uses the cookie-less client and is
 * cached under the site content tag; a read that fails falls back to the text in code and is logged.
 */
export async function getLegalDocument(kind: LegalKind): Promise<LegalDocument> {
  "use cache";
  cacheTag(CACHE_TAGS.siteSettings);
  cacheLife("minutes");

  if (!isEditable(kind)) return legalDocument(kind);
  const { data, error } = await createPublicSupabase()
    .from("site_settings")
    .select("value")
    .eq("key", LEGAL_SETTING_KEYS[kind])
    .maybeSingle();
  if (error) {
    logger.error("a legal page could not be read, using the text in code", {
      errorCode: error.code,
      page: kind,
    });
    return legalDocument(kind);
  }
  const { published } = rowOf(data?.value ?? null);
  return published ? documentOf(kind, published) : legalDocument(kind);
}

/** What the legal editor opens on. */
export interface LegalEditPage {
  kind: EditableLegalKind;
  /** The text to edit: the working copy if there is one, else the published text, else the text in code. */
  document: LegalDocument;
  /** True when a working copy exists: it has been saved but not published. */
  hasUnpublishedChanges: boolean;
  /** The live version, or null when the page still shows the placeholder text from code. */
  published: { updated: string | null; version: string | null } | null;
}

/**
 * The page the editor starts from (ADR-151). Read as the signed-in admin and never cached: an editor must open on
 * what was last saved, not on a copy kept for minutes. A failed read throws, so the error page shows it.
 */
export async function getLegalEditPage(kind: EditableLegalKind): Promise<LegalEditPage> {
  const { data, error } = await (
    await createServerSupabase()
  )
    .from("site_settings")
    .select("value")
    .eq("key", LEGAL_SETTING_KEYS[kind])
    .maybeSingle();
  if (error) throw new Error("The legal page could not be read");
  const { published, working } = rowOf(data?.value ?? null);
  const stored = working ?? published;
  return {
    kind,
    document: stored ? documentOf(kind, stored) : legalDocument(kind),
    hasUnpublishedChanges: working !== undefined,
    published: published ? { updated: published.updated, version: published.version } : null,
  };
}
