import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { FEEDBACK_PAGE_SIZE } from "./constants";
import type { FeedbackFilters } from "./schemas";
import { toFeedbackViews, type FeedbackCounts, type FeedbackPage } from "./view";

/** One page of feedback, newest first, as the signed-in super admin (the database function returns nothing to anyone else). */
export async function getFeedbackPage(filters: FeedbackFilters): Promise<FeedbackPage> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_feedback_list", {
    p_state: filters.state,
    p_limit: FEEDBACK_PAGE_SIZE,
    p_offset: (filters.page - 1) * FEEDBACK_PAGE_SIZE,
  });
  if (error) {
    logger.error("admin feedback could not be read", { errorCode: error.code });
    throw error;
  }
  const total = Number(data[0]?.total_count ?? 0);
  return {
    items: toFeedbackViews(data),
    state: filters.state,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE)),
    total,
  };
}

/** How many messages there are and how many are not reviewed. */
export async function getFeedbackCounts(): Promise<FeedbackCounts> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_feedback_counts");
  if (error) {
    logger.error("admin feedback counts could not be read", { errorCode: error.code });
    throw error;
  }
  const row = data[0];
  return { total: Number(row?.total ?? 0), notReviewed: Number(row?.not_reviewed ?? 0) };
}
