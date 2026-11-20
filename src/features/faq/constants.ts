/**
 * The limits of a FAQ question (ADR-143). They match the table's checks, so the database only refuses what the form
 * could not see (a category of another list, a published question put in the trash).
 */
export const FAQ_QUESTION_MIN = 5;
export const FAQ_QUESTION_MAX = 300;
export const FAQ_ANSWER_MIN = 5;
export const FAQ_ANSWER_MAX = 5000;
export const FAQ_SORT_MAX = 10000;

/** How many questions one "put in order" call may hold (the same limit as the database function). */
export const FAQ_REORDER_MAX = 200;
/** The longest search a visitor may type, and the most questions one read returns (the database function's limits). */
export const FAQ_SEARCH_MAX = 200;
export const FAQ_LIST_LIMIT = 200;

/** A question is a draft until the admin publishes it. A question in the trash is always a draft. */
export const FAQ_STATUSES = ["draft", "published"] as const;
export type FaqStatus = (typeof FAQ_STATUSES)[number];

/** The admin list's tabs: everything that is not in the trash, one status, or the trash itself. */
export const FAQ_ADMIN_VIEWS = ["all", "published", "draft", "trash"] as const;
export type FaqAdminViewName = (typeof FAQ_ADMIN_VIEWS)[number];
