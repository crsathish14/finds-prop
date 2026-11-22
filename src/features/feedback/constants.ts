/** The longest feedback message, as `builder_feedback.message` allows. */
export const FEEDBACK_MESSAGE_MAX = 1000;

/** The filter above the admin's list: every message, those not yet reviewed, or those reviewed. */
export const FEEDBACK_STATES = ["all", "open", "reviewed"] as const;
export type FeedbackState = (typeof FEEDBACK_STATES)[number];

/** Rows on one page of the admin's list. */
export const FEEDBACK_PAGE_SIZE = 25;

/** Where the pages are. */
export const ADMIN_FEEDBACK_PATH = "/admin/feedback";
export const BUILDER_FEEDBACK_PATH = "/builder/feedback";
