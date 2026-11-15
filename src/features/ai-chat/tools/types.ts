/**
 * The shape of a tool the assistant may call (ADR-128 sections 4.1 and 5). The model never touches the
 * database: it can only ask for one of these by name, and each one wraps a cached public read the website
 * pages already use, so the assistant sees what any visitor sees and cannot disagree with the pages.
 *
 * A tool is five things: a name, a description, a Zod schema for what it takes, a Zod schema for what it
 * gives back, and `run`. Nothing else decides what a tool can do. The agent loop never calls `run` itself:
 * it goes through `runTool` (`run.ts`), which checks the input before and the output after.
 */
import type { z } from "zod";
import type { Translate } from "@/lib/format";

/**
 * What a tool is given besides its input: only what turning numbers into text needs. It names no person on
 * purpose: no user id, phone, email or session, so no tool can look anyone up (ADR-128 section 4.1,
 * principle 5, and section 6.4.3).
 */
export interface ToolContext {
  /** The translator for the words around numbers (₹, L, Cr, /mo, sq.ft), which live in en.json. */
  readonly translate: Translate;
  /** The language the numbers and dates are written in. */
  readonly locale: string;
}

/**
 * A record a tool result names. The loop keeps these for one customer message, so a card or a link is only
 * ever built by code for an id a tool returned in that message (ADR-128 section 4.1, principle 3). The model
 * is shown the id only; the slug is here for the address, which code builds (`/properties/{slug}-{shortId}`
 * for a home, `/projects/{slug}` for a project, whose slug is its only id).
 */
export type ToolReference =
  | {
      readonly kind: "home";
      /** The public id of the home (`short_id`), the same value the tool result shows as `homeId`. */
      readonly homeId: string;
      readonly slug: string;
    }
  | {
      readonly kind: "project";
      /** The project's slug, the same value the tool result shows as `slug`. */
      readonly slug: string;
    };

/** What names a reference once in a set: its kind and its id (a home's public id, a project's slug). */
export function referenceKey(reference: ToolReference): string {
  return reference.kind === "home" ? `home:${reference.homeId}` : `project:${reference.slug}`;
}

/** What `run` gives back: the result for the model, and the records that result names. */
export interface ToolRun<Output> {
  readonly output: Output;
  readonly references: readonly ToolReference[];
}

/**
 * What a tool does to the world, which is what the agent loop's parallel rule turns on (ADR-128 section 4.5):
 * - `read`: looks something up. Up to `MAX_PARALLEL_READ_CALLS` run together in one round.
 * - `propose`: prepares something for the customer to confirm with a click (section 5.3). It writes nothing,
 *   and it always runs alone in its round.
 */
export type ToolKind = "read" | "propose";

export interface AiChatTool<Input, Output> {
  /** Lowercase letters, digits and underscores (`search_properties`): the name the model asks for. */
  readonly name: string;
  /** Whether the loop may run it beside other calls (`read`) or only alone (`propose`). */
  readonly kind: ToolKind;
  /** What the tool is for and how to read its result, written for the model. Never shown to a customer. */
  readonly description: string;
  /** What the tool takes. It must stay inside the portable subset (`toPortableJsonSchema`), and name no person. */
  readonly input: z.ZodType<Input>;
  /** What the tool gives back. Anything `run` returns that is not in this schema is dropped before the model sees it. */
  readonly output: z.ZodType<Output>;
  /** Reads and shapes the result. It may throw: `runTool` turns that into an error result, never an exception. */
  run(input: Input, context: ToolContext): Promise<ToolRun<Output>>;
}

/**
 * Any tool, whatever it takes and gives: what a list of tools holds. `run` is written as a method above so
 * that a tool with its own input type fits here; `runTool` only ever hands a tool the value its own schema
 * has just parsed, which is what makes that safe.
 */
export type AnyAiChatTool = AiChatTool<unknown, unknown>;

/**
 * Why a call got no result, as a code the model can act on (never a sentence, never a database message):
 * - `unknown_tool`: no tool has that name.
 * - `invalid_input`: the input does not fit the tool's schema; `fields` names what to correct.
 * - `unavailable`: the read failed or its result did not fit. "That information isn't available right now."
 *
 * The propose tools (ADR-128 section 5.3) refuse with three more, thrown as a `ToolRefusal`. Each is one code for
 * every reason behind it on purpose, so a refusal tells the model what to say and nothing about why:
 * - `not_available`: the home or project is not open for requests. It is the same answer for a home that was
 *   never listed, is waiting for review, was withdrawn, sold or rented, or whose builder is not active.
 * - `own_home`: the signed-in customer owns the home, so they cannot enquire about it.
 * - `date_out_of_range`: the visit day is not from today to a year ahead.
 *
 * The last four are the agent loop's own refusals (ADR-128 section 4.5), given instead of running the call:
 * - `timeout`: the tool did not answer within `TOOL_TIMEOUT_MS`.
 * - `too_many_calls`: more read calls than may run together in one round.
 * - `call_limit`: the calls for this customer message are used up.
 * - `call_alone`: a propose tool was mixed with other calls; ask for it alone in the next round.
 */
export const TOOL_ERROR_CODES = [
  "unknown_tool",
  "invalid_input",
  "unavailable",
  "not_available",
  "own_home",
  "date_out_of_range",
  "timeout",
  "too_many_calls",
  "call_limit",
  "call_alone",
] as const;
export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

/**
 * A line for the model beside the loop's own refusals, so it knows what to do next. It is addressed to the
 * model, never shown to a customer, and holds no data. The older codes need none: their meaning is plain.
 */
export const TOOL_ERROR_HINTS: Partial<Record<ToolErrorCode, string>> = {
  not_available:
    "That home or project is not open for requests. Do not try another id; tell the customer it is not available.",
  own_home: "The customer owns this home, so they cannot enquire about it. Tell them so.",
  date_out_of_range:
    "A visit day must be from today to one year ahead, in India time. Ask the customer for another day.",
  timeout: "That information isn't available right now. Do not retry it; answer without it.",
  too_many_calls: "Too many calls this round. Ask again next round if it is still needed.",
  call_limit: "No more calls are allowed for this message. Answer from what you already have.",
  call_alone: "This tool must be called alone. Call it again next round with no other call.",
};

/**
 * What a tool throws to refuse a call on purpose: `runTool` turns it into the error result with this code (and
 * `fields`, for `invalid_input`), without logging it as a failure. Any other thrown error is `unavailable`.
 */
export class ToolRefusal extends Error {
  readonly code: ToolErrorCode;
  readonly fields: readonly string[];

  constructor(code: ToolErrorCode, fields: readonly string[] = []) {
    super(`The tool refused the call: ${code}`);
    this.name = "ToolRefusal";
    this.code = code;
    this.fields = fields;
  }
}

/**
 * What one tool call came to. `content` is the text sent back to the model as the tool result (JSON, so
 * third-party text inside it is quoted data); the other fields are for the loop and the output checks.
 */
export type ToolOutcome =
  | {
      readonly status: "ok";
      /** The result, checked against the tool's output schema. */
      readonly output: unknown;
      readonly references: readonly ToolReference[];
      readonly content: string;
    }
  | {
      readonly status: "error";
      readonly code: ToolErrorCode;
      /** The input fields that did not fit, for `invalid_input`; empty otherwise. */
      readonly fields: readonly string[];
      readonly content: string;
    };
