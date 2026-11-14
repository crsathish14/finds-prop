/**
 * The identity of the system prompt (ADR-128 section 6.2). Both values change together with the prompt files in
 * this folder, and only then.
 */

/**
 * The version of the system prompt: the date of the last change to the wording, and a number for that day. Raise it
 * in the same pull request that changes any prompt file, so a usage row, an eval run and a bug report can say which
 * wording was in use. It is part of the prompt text, so a test that reads the prompt can see it.
 */
export const SYSTEM_PROMPT_VERSION = "2026-11-14.1";

/**
 * A random string placed in the system prompt, with the order never to write it. It means nothing and guards
 * nothing by being secret: the output check (`guards/output.ts`) blocks any answer that contains it, which catches a
 * reply that copies the prompt. It holds no key, no address and no name. If the string ever shows up in a customer's
 * screenshot, change it here (with a new prompt version) and nothing else breaks.
 */
export const SYSTEM_PROMPT_CANARY = "fpc-gvgKkZ7GywmA-4d1b";
