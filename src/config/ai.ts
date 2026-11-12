/**
 * The numbers and names of the AI chat assistant, in one file (ADR-128 sections 4.5 and 7, D9). None of
 * them is written in a prompt, a component or the agent loop: they all read from here.
 *
 * Left out on purpose, because the owner has not set a value yet (docs/ai-chat-phase-plan.md, gates G-B
 * and G-C): the daily budget for the global limit, the example loan interest rate, and the time for the
 * whole message (it must stay below the route's `maxDuration`, which the endpoint task sets). Do not invent
 * them here; add each with the task that needs it, once the owner has chosen.
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
