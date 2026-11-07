import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { DRAFTS_LIMIT } from "./constants";
import {
  DRAFT_COLUMNS,
  DRAFT_SUMMARY_COLUMNS,
  toDraftSummaries,
  toDraftView,
  type DraftSummary,
  type DraftView,
} from "./view";

/**
 * The signed-in owner's draft, for the wizard to open at `/post-property/[id]` (S6-T02, FR-ACC-08), or
 * null when the listing is not theirs or does not exist (a stranger's listing looks the same as a missing
 * one). `my_properties()` returns only the caller's own rows, drafts included. Any status comes back, so
 * the page can send a pending or approved listing to the dashboard. A failed read throws: the error page
 * shows it.
 */
export async function getMyDraft(listingId: string): Promise<DraftView | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc("my_properties")
    .select(DRAFT_COLUMNS)
    .eq("id", listingId)
    .maybeSingle();
  if (error) {
    logger.error("listing draft could not be read", { errorCode: error.code });
    throw error;
  }
  if (!data) return null;
  const photos = await supabase
    .from("listing_media")
    .select("id, storage_path, position")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });
  if (photos.error) {
    logger.error("listing draft photos could not be read", { errorCode: photos.error.code });
    throw photos.error;
  }
  return toDraftView(data, photos.data);
}

/** The owner's drafts, the most recently changed first, for "Your drafts" on the post-property page. */
export async function listMyDrafts(): Promise<DraftSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc("my_properties")
    .select(DRAFT_SUMMARY_COLUMNS)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(DRAFTS_LIMIT);
  if (error) {
    logger.error("listing drafts could not be read", { errorCode: error.code });
    throw error;
  }
  return toDraftSummaries(data);
}
