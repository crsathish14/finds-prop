import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { FAQ_LIST_LIMIT, FAQ_SEARCH_MAX } from "./constants";
import {
  FAQ_ADMIN_COLUMNS,
  toAdminFaqViews,
  toFaqViews,
  type FaqAdminView,
  type FaqView,
} from "./view";

/** What a visitor (or the assistant) asks of the search: words, one category's slug, and how many answers. */
export interface FaqSearch {
  query?: string | undefined;
  categorySlug?: string | undefined;
  limit?: number | undefined;
}

/**
 * The one public read of the FAQ, shared by the website and the AI assistant's tool (ADR-143): the database function
 * `search_faqs`, which runs as the caller, so it returns only published questions of active categories. Takes the
 * client so the page's cached read, the uncached search and the assistant each pass their own. Words longer than the
 * database's limit are cut here, so a long paste is a search and not an error. A failed read throws; the callers decide
 * what the visitor sees.
 */
export async function searchFaqs(
  supabase: SupabaseClient<Database>,
  search: FaqSearch = {},
): Promise<FaqView[]> {
  const query = search.query?.trim().slice(0, FAQ_SEARCH_MAX);
  const { data, error } = await supabase.rpc("search_faqs", {
    ...(query ? { p_query: query } : {}),
    ...(search.categorySlug ? { p_category: search.categorySlug } : {}),
    p_limit: search.limit ?? FAQ_LIST_LIMIT,
  });
  if (error) throw error;
  return toFaqViews(data);
}

/**
 * Every published question in the admin's order (category, then question), for the page without a search. Public data,
 * so it uses the cookie-less client and is cached under the `faq` tag, which every change refreshes. A failed read
 * answers an empty list and is logged, so the page still renders (its empty state shows).
 */
export async function getPublicFaqs(): Promise<FaqView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.faq);
  cacheLife("minutes");

  try {
    return await searchFaqs(createPublicSupabase());
  } catch (failure) {
    logger.error("the FAQ could not be read", { errorCode: errorCodeOf(failure) });
    return [];
  }
}

/**
 * A search of the published questions. Never cached (a search is not): the words come from the address. A failed read
 * answers an empty list and is logged, like the cached one.
 */
export async function searchPublicFaqs(search: FaqSearch): Promise<FaqView[]> {
  try {
    return await searchFaqs(createPublicSupabase(), search);
  } catch (failure) {
    logger.error("the FAQ search failed", { errorCode: errorCodeOf(failure) });
    return [];
  }
}

function errorCodeOf(failure: unknown): string {
  return typeof failure === "object" && failure !== null && "code" in failure
    ? String((failure as { code: unknown }).code)
    : "unknown";
}

/**
 * The admin's questions: the ones in the trash, or all the others (drafts and published). Read as the signed-in admin
 * through their own session (the policies show drafts and the trash only to the super admin). Never cached: the list
 * must be right after every change. A failed read throws, so the portal's error page shows it.
 */
export async function readAdminFaqs(
  supabase: SupabaseClient<Database>,
  scope: { trashed: boolean },
): Promise<FaqAdminView[]> {
  const base = supabase.from("faqs").select(FAQ_ADMIN_COLUMNS);
  const { data, error } = await (
    scope.trashed ? base.not("deleted_at", "is", null) : base.is("deleted_at", null)
  )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("the admin's FAQ could not be read", { errorCode: error.code });
    throw error;
  }
  return toAdminFaqViews(data);
}

export async function getAdminFaqs(scope: { trashed: boolean }): Promise<FaqAdminView[]> {
  return readAdminFaqs(await createServerSupabase(), scope);
}

/** One question for the edit form, in any status, trashed or not; null when there is none with that id. */
export async function readAdminFaq(
  supabase: SupabaseClient<Database>,
  faqId: string,
): Promise<FaqAdminView | null> {
  const { data, error } = await supabase
    .from("faqs")
    .select(FAQ_ADMIN_COLUMNS)
    .eq("id", faqId)
    .maybeSingle();
  if (error) {
    logger.error("the admin's question could not be read", { errorCode: error.code });
    throw error;
  }
  return data ? (toAdminFaqViews([data])[0] ?? null) : null;
}

export async function getAdminFaq(faqId: string): Promise<FaqAdminView | null> {
  return readAdminFaq(await createServerSupabase(), faqId);
}
