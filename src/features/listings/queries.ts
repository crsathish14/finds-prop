import "server-only";
import { PHOTO_BUCKET } from "@/features/media";
import { getSessionView } from "@/server/auth/get-session-view";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { publicEnv } from "@/lib/public-env";
import { publicStorageUrl } from "@/lib/storage-url";
import { DRAFTS_LIMIT } from "./constants";
import {
  DRAFT_COLUMNS,
  DRAFT_SUMMARY_COLUMNS,
  MY_LISTING_COLUMNS,
  toDraftSummaries,
  toDraftView,
  toMyListings,
  type DraftSummary,
  type DraftView,
  type MyListing,
} from "./view";

/**
 * Whether anyone is signed in. The layout's gate sends a visitor away, but a page is rendered alongside its
 * layout, not after it (and the header's "Post property" link is prefetched on every page), so a page asks
 * for itself and draws nothing for a visitor instead of reading the database for nobody.
 */
export async function isSignedIn(): Promise<boolean> {
  return (await getSessionView()) !== null;
}

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
  // Whether a place is stored, asked of the database as a filter: only the listing's id comes back, never the
  // point, which is the owner's private location (DEC-35, ADR-141).
  const located = await supabase
    .rpc("my_properties")
    .select("id")
    .eq("id", listingId)
    .not("location", "is", null)
    .maybeSingle();
  if (located.error) {
    logger.error("listing location could not be checked", { errorCode: located.error.code });
    throw located.error;
  }
  return toDraftView(data, photos.data, located.data !== null);
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

/** The most listings "My listings" reads; the newest first. */
export const MY_LISTINGS_LIMIT = 200;

/**
 * The signed-in owner's listings outside the drafts, newest first, with the first photo of each (S6-T03,
 * FR-ACC-09). `my_properties()` returns only the caller's own rows, rejection reason included. Drafts are left
 * out: they have their own list on the post-property page. The time is taken here, in the read, so the list
 * says "posted 2 days ago" as of this request. A failed read throws, so the account's error page shows it.
 */
export async function getMyListings(): Promise<{ listings: MyListing[]; now: number }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc("my_properties")
    .select(MY_LISTING_COLUMNS)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(MY_LISTINGS_LIMIT);
  if (error) {
    logger.error("my listings could not be read", { errorCode: error.code });
    throw error;
  }
  const ids = data.map((row) => row.id);
  if (ids.length === 0) return { listings: [], now: Date.now() };
  const photos = await supabase
    .from("listing_media")
    .select("listing_id, storage_path, position")
    .in("listing_id", ids)
    .order("position", { ascending: true });
  if (photos.error) {
    logger.error("the photos of my listings could not be read", { errorCode: photos.error.code });
    throw photos.error;
  }
  const listings = toMyListings(data, photos.data, (path) =>
    publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, PHOTO_BUCKET, path),
  );
  return { listings, now: Date.now() };
}

/** The listings of the owner that the location prompt is about (ADR-141 addendum, plan PR 7c). */
export interface ListingsWithoutLocation {
  /** How many of the owner's listings in review or Live have no place stored. */
  count: number;
  /** The newest of them, where "Add location" leads, or null when there is none. */
  firstId: string | null;
  /** Whether any of them is Live: adding a place to one sends it back to review (ADR-138, policy C). */
  anyLive: boolean;
}

/**
 * The owner's listings in review or Live that have no place stored, for the one note at the top of My listings
 * (plan PR 7c). Asked of the database as a filter (`location is null`) with only the id, the state and the sort date selected:
 * the point is the owner's private location (DEC-35) and is never read. Rejected listings are left out (they must
 * add a place to be sent again), and so are sold and rented ones, which are final. A failed read throws, so the
 * account's error page shows it.
 */
export async function getListingsWithoutLocation(): Promise<ListingsWithoutLocation> {
  const supabase = await createServerSupabase();
  const { data, count, error } = await supabase
    .rpc("my_properties", undefined, { count: "exact" })
    // `created_at` is selected because the sort column must be in the select for an RPC (the sort on an
    // unselected column fails on the live database: "column properties.created_at does not exist").
    .select("id, status, created_at")
    .in("status", ["pending", "approved"])
    .is("location", null)
    .order("created_at", { ascending: false })
    .limit(MY_LISTINGS_LIMIT);
  if (error) {
    logger.error("listings without a location could not be read", { errorCode: error.code });
    throw error;
  }
  const first = data[0];
  return {
    count: count ?? data.length,
    firstId: first ? first.id : null,
    anyLive: data.some((row) => row.status === "approved"),
  };
}

/**
 * How many listings the signed-in owner has outside the drafts (the number on the My listings tab), counted by
 * the database. A failed read throws, so the account's error page shows it.
 */
export async function countMyListings(): Promise<number> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .rpc("my_properties", undefined, { count: "exact", head: true })
    .neq("status", "draft");
  if (error) {
    logger.error("my listings could not be counted", { errorCode: error.code });
    throw error;
  }
  return count ?? 0;
}
