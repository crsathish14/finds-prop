/**
 * The numbers and names of the AI chat assistant, in one file (ADR-128 sections 4.5 and 7, D9). None of
 * them is written in a prompt, a component or the agent loop: they all read from here.
 *
 * Left out on purpose, because the owner has not set a value yet (docs/ai-chat-phase-plan.md, gate G-B):
 * the time for the whole message (it must stay below the route's `maxDuration`, which the endpoint task
 * sets). Do not invent it here; add it with the task that needs it, once the owner has chosen. The daily
 * budget is a marked placeholder below (`owner to confirm`) so the global limit exists and fails safe.
 */

/** What the assistant calls the product in every piece of its own text. Lowercase on purpose (ADR-128, D11). */
export const ASSISTANT_BRAND_NAME = "findsprop";

/** The model is called at most this many times for one customer message; the last round only answers. */
export const MAX_MODEL_ROUNDS = 5;

/** Tool calls in all, across every round of one customer message. Parallel calls count toward it. */
export const MAX_TOOL_CALLS_PER_MESSAGE = 6;

/** Read tools that may run in parallel in one round. Propose tools always run alone. */
export const MAX_PARALLEL_READ_CALLS = 3;

/** How long one tool may take, in milliseconds, so a slow read cannot hold the whole turn. */
export const TOOL_TIMEOUT_MS = 3000;

/** The longest customer message the assistant accepts, in characters. */
export const MAX_INPUT_CHARACTERS = 1000;

/** The most tokens the model may write in one round ("about 1,200" in ADR-128 section 7). */
export const MAX_OUTPUT_TOKENS = 1200;

/** The most items one tool result holds ("at most 10 items and compact fields", ADR-128 section 5). */
export const MAX_TOOL_RESULT_ITEMS = 10;

/**
 * The longest piece of third-party text (a listing's description) a tool hands to the model, in characters.
 * Longer text is cut and the result says so, which keeps a tool result compact (ADR-128 section 5.4, test 4).
 * An engineering limit, not an owner decision: a listing's description may be 5,000 characters.
 */
export const MAX_UNTRUSTED_TEXT_CHARACTERS = 1500;

/**
 * The EMI defaults of the `calculate_emi` tool (ADR-128 section 5.2, decision D10). They are only used when
 * the customer gives no value of their own, and the assistant always shows them as "an example, not a bank
 * offer". The maths that uses them is `src/lib/emi.ts`.
 */

/** Down payment as a percentage of the price. */
export const EMI_DEFAULT_DOWN_PAYMENT_PERCENT = 20;

/** Loan term in years. */
export const EMI_DEFAULT_YEARS = 20;

/**
 * The example interest rate, in percent a year, set by the owner on 14 Nov 2026 (gate G-C). It is an
 * example for the maths, never a lender's offer or current rate, and no text may present it as one.
 */
export const EMI_EXAMPLE_ANNUAL_RATE_PERCENT = 7.2;

/**
 * Rate limits of the chat (ADR-128 section 7, decision D9; the rules are in `src/server/rate-limit/limits.ts`).
 * The counters live in the database; only the numbers are here.
 */

/** Anonymous visitors get this many free messages, then the sign-in gate (D2, D9). */
export const AI_TRIAL_MESSAGES = 2;

/**
 * The free trial counts over one year, so the window is 366 days. The database accepts at most this (migration
 * 20261114120000) and keeps the trial rows for 400 days. Do not raise it without a new migration.
 */
export const AI_TRIAL_WINDOW_SECONDS = 366 * 24 * 60 * 60;

/** A loose per-address backstop for anonymous messages a day. Many mobile users share one carrier address. */
export const AI_ANONYMOUS_IP_MESSAGES_PER_DAY = 40;

/** At most this many messages a minute from one caller, signed in or not (BR-73, the UX note). */
export const AI_BURST_MESSAGES_PER_MINUTE = 10;

/** A signed-in customer's messages a day ("adjust after cost data", ADR-128 section 7). */
export const AI_SIGNED_IN_MESSAGES_PER_DAY = 40;

/**
 * PLACEHOLDER, owner to confirm (gate G-B): the most messages the whole chat answers in a day, for every caller
 * together. When it is used up, the chat shows "AI search is unavailable right now". The owner has not set a
 * value; 1,000 is only a stand-in so the limit exists and fails safe. It is set for real in task AI-P8-T03.
 */
export const AI_GLOBAL_DAILY_MESSAGE_BUDGET = 1000;

/**
 * The anonymous cookie id (D13): a random first-party id that counts the free trial per browser. It is kept for
 * a year, the length of the trial, and used for nothing else. PLACEHOLDER wording of the cookie policy: owner to
 * confirm (gate G-E, legal review).
 */
export const AI_ANONYMOUS_COOKIE_NAME = "fp_ai_anon";
export const AI_ANONYMOUS_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
