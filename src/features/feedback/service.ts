import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapFeedbackError, type FeedbackStore } from "./feedback-service";

/** Feedback is saved here as the signed-in user through their cookies; the database functions check the caller. */
export async function createFeedbackStore(): Promise<FeedbackStore> {
  return feedbackStore(await createServerSupabase());
}

/** The same store for any client that acts as the user (the integration tests sign in and pass theirs). */
export function feedbackStore(supabase: SupabaseClient<Database>): FeedbackStore {
  return {
    async send(message) {
      const { data, error } = await supabase.rpc("submit_builder_feedback", { p_message: message });
      if (error) throw mapFeedbackError(error);
      return data;
    },
    async setReviewed(feedbackId, reviewed) {
      const { data, error } = await supabase.rpc("admin_set_feedback_reviewed", {
        p_id: feedbackId,
        p_reviewed: reviewed,
      });
      if (error) throw mapFeedbackError(error);
      return data;
    },
  };
}
