import type { FeedbackState } from "./constants";

/** One message as the admin's list shows it. Dates are ISO text; the screen formats them. */
export interface FeedbackView {
  id: string;
  builderId: string;
  builderName: string;
  /** "builder" or "agent": the sender's role. */
  kind: "builder" | "agent";
  message: string;
  createdAt: string;
  /** Null when not reviewed. */
  reviewedAt: string | null;
}

export interface FeedbackPage {
  items: FeedbackView[];
  state: FeedbackState;
  page: number;
  pageCount: number;
  /** Messages the filter matches in all. */
  total: number;
}

export interface FeedbackCounts {
  total: number;
  notReviewed: number;
}

interface FeedbackRow {
  id: string;
  builder_id: string;
  builder_name: string;
  builder_kind: string;
  message: string;
  created_at: string;
  reviewed_at: string | null;
}

export function toFeedbackViews(rows: readonly FeedbackRow[]): FeedbackView[] {
  return rows.map((row) => ({
    id: row.id,
    builderId: row.builder_id,
    builderName: row.builder_name,
    kind: row.builder_kind === "agent" ? "agent" : "builder",
    message: row.message,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}
