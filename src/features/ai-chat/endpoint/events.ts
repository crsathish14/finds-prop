import type { ToolReference } from "../tools/types";

/**
 * What the endpoint streams (ADR-128 section 4, "stream: text deltas, cards, ..."). The body is newline-delimited
 * JSON (`application/x-ndjson`): one event per line, each a complete JSON object, in this order:
 *
 *   start, then any of status / notice / text / card, then exactly one done.
 *
 * `replace` swaps the whole message for a fixed line (a blocked answer, or a turn that could not finish); nothing
 * but `done` follows it. Every sentence is fixed wording from `en.json` that the server has already turned into
 * text, so the browser needs no key of its own. Text and cards are checked by the output guard before they get here.
 * A card is only a reference (a home's public id and slug, or a project's slug): the page draws the card and builds
 * the link itself, and the model never writes one.
 */
export type ChatStreamEvent =
  | { readonly type: "start"; readonly requestId: string }
  /** The fixed "Searching…" while tools run. */
  | { readonly type: "status"; readonly text: string }
  /** A checked, plain-text piece of the answer (or a fixed refusal). */
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "card"; readonly reference: ToolReference }
  /** A fixed note beside the answer: "I removed personal details", the cap note, the disclaimer. */
  | { readonly type: "notice"; readonly key: string; readonly text: string }
  /** Swap the message for this line. `href` is a link built by code (the fixed fallback offers the search page). */
  | {
      readonly type: "replace";
      readonly key: string;
      readonly text: string;
      readonly href?: string;
    }
  | { readonly type: "done"; readonly outcome: Exclude<ChatOutcome, "rate_limited"> };

/**
 * How a message ended, as the usage row and the browser see it:
 * `answered` and `limit` (a limit forced a shorter answer) have text; `refused` is a fixed reply from the input check
 * (no model call); `blocked` is an answer the output check replaced; `fallback` is a turn that could not finish;
 * `aborted` is a customer who left; `error` is an unexpected failure; `rate_limited` is a message a limit refused
 * (only in the usage row: no stream is sent, the answer is the JSON failure of `responses.ts`).
 */
export type ChatOutcome =
  "answered" | "limit" | "refused" | "blocked" | "fallback" | "aborted" | "error" | "rate_limited";

const encoder = new TextEncoder();

/** One event as the bytes of its line. */
export function encodeChatEvent(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}
