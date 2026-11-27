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
  /**
   * Whether the customer is signed in. The tools that list homes, projects, localities or a builder's projects are for
   * signed-in customers (login wall, ADR-171) and refuse with `sign_in_required` otherwise. It is one yes or no, not a
   * person: no id, phone or session reaches a tool.
   */
  readonly signedIn: boolean;
  /** The translator for the words around numbers (₹, L, Cr, /mo, sq.ft), which live in en.json. */
  readonly translate: Translate;
  /** The language the numbers and dates are written in. */
  readonly locale: string;
  /**
   * What the chat remembers about its searches (ADR-206): the ids the current search already showed, so a next page
   * repeats none, and the homes and projects shown earlier in the chat. Absent means nothing is remembered (a test, an
   * eval): every search is a first page. It names no person: only listing ids.
   */
  readonly search?: SearchMemory;
  /**
   * Tells the chat window the step a tool has reached (ADR-217), as an `en.json` key of the status lines, such as the
   * widening steps of a home search. Absent means nobody is listening (a test, an eval, Show more).
   */
  readonly status?: (messageKey: StatusMessageKey) => void;
  /**
   * The tools that gave a result (not an error) in an earlier round of this customer message, each once (ADR-218): the web
   * search runs only after a lookup on our own site. Absent means none.
   */
  readonly earlierResults?: readonly string[];
  /**
   * Adds what a tool spent on a paid call of its own (the web search, ADR-218) to the message's usage row: the tokens of
   * that call and the web searches it ran. Absent means nobody is counting (a test, an eval).
   */
  readonly spend?: (spend: ToolSpend) => void;
}

/** What a tool's own paid call spent (ADR-218), added to the message's usage. */
export interface ToolSpend {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly webSearches: number;
}

/**
 * The status lines the chat window shows while the assistant works (ADR-217, owner-approved words, English only), as
 * `en.json` keys written out so the message check finds them.
 */
export const STATUS_MESSAGE_KEYS = {
  searching: "ai.searching",
  homes: "ai.status.homes",
  articles: "ai.status.articles",
  builders: "ai.status.builders",
  web: "ai.status.web",
  nearby: "ai.status.nearby",
  wider: "ai.status.wider",
  widest: "ai.status.widest",
} as const;
export type StatusMessageKey = (typeof STATUS_MESSAGE_KEYS)[keyof typeof STATUS_MESSAGE_KEYS];

/** The two searches whose results are paged (ADR-206). */
export type PagedSearchName = "search_properties" | "search_projects";

/** One page a search gave, as the chat remembers it. */
export interface SearchPage {
  readonly tool: PagedSearchName;
  /** The tool's input without its page. */
  readonly filters: Readonly<Record<string, unknown>>;
  /** Every id this search has given so far, in the ranked order (the earlier pages first). */
  readonly shown: readonly string[];
  /** How many match in all. */
  readonly total: number;
  /** True for a search around a place. */
  readonly place: boolean;
}

export interface SearchMemory {
  /** The ids the remembered search already gave, when it is this tool with these filters; otherwise none. */
  shownBefore(tool: PagedSearchName, filters: Readonly<Record<string, unknown>>): readonly string[];
  /** Whether this home (homeId) or project (slug) was shown earlier in the chat. */
  seenBefore(tool: PagedSearchName, id: string): boolean;
  /** Remembers the page a search gave: the last one of the message becomes the current search. */
  record(page: SearchPage): void;
  /** The chat's current search (the last one recorded, or the one the browser sent back), or null. */
  current(): SearchPage | null;
}

/**
 * A record a tool result names. The loop keeps these for one customer message, so a card or a link is only
 * ever built by code for an id a tool returned in that message (ADR-128 section 4.1, principle 3). The model
 * is shown the id only; the slug is here for the address, which code builds (`/properties/{slug}-{shortId}`
 * for a home, `/projects/{slug}` for a project, whose slug is its only id).
 */
export type ToolReference = CardReference | SourceReference;

/** A record the chat draws as a card under the answer (a home or a project). */
export type CardReference =
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

/**
 * A record the chat names as a source under the answer (ADR-143 section 6.5): an article, a question of the FAQ and a job
 * (ADR-143 section 6). The server builds the link (`source-links.ts`) from the id or
 * slug a tool returned in the same message, and the title it draws as the link's words is the one the read gave
 * (cleaned as third-party text). `opened` is true for a record the assistant read in full (`get_content_item`): when
 * one was, only the opened ones are drawn as sources; when none was, the best matches of the search are.
 */
export type SourceReference =
  | {
      readonly kind: "article";
      /** The article's id, the same value the tool result shows as `id`. */
      readonly id: string;
      /** The article's address word (`/blog/<slug>`). */
      readonly slug: string;
      readonly title: string;
      readonly opened: boolean;
    }
  | {
      readonly kind: "faq";
      /** The question's id, the same value the tool result shows as `id`. */
      readonly id: string;
      readonly title: string;
      readonly opened: boolean;
    }
  | {
      /** An open job (`search_jobs`, `get_content_item`); the page is `/careers/<slug>`. */
      readonly kind: "job";
      readonly slug: string;
      readonly title: string;
      readonly opened: boolean;
    };

/** What names a reference once in a set: its kind and its id (a home's public id, a project's slug, an article's id). */
export function referenceKey(reference: ToolReference): string {
  switch (reference.kind) {
    case "home":
      return `home:${reference.homeId}`;
    case "project":
      return `project:${reference.slug}`;
    case "article":
    case "faq":
      return `${reference.kind}:${reference.id}`;
    case "job":
      return `job:${reference.slug}`;
  }
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

/** The groups of tools that share a cap of calls per customer message (`AI_TOOL_GROUP_CALL_LIMITS`). */
export type ToolCallGroup = "content" | "web";

export interface AiChatTool<Input, Output> {
  /** Lowercase letters, digits and underscores (`search_properties`): the name the model asks for. */
  readonly name: string;
  /** Whether the loop may run it beside other calls (`read`) or only alone (`propose`). */
  readonly kind: ToolKind;
  /**
   * The tool group whose calls are capped together inside the message's total (`AI_TOOL_GROUP_CALL_LIMITS`): the two
   * content tools share 2 of the 6 calls (ADR-143 section 6.3). Absent for a tool with no cap of its own.
   */
  readonly callGroup?: ToolCallGroup;
  /** How long the loop waits for this tool, in milliseconds; absent is `TOOL_TIMEOUT_MS`. Only a tool that reads the web needs longer. */
  readonly timeoutMs?: number;
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
 * - `sign_in_required`: the tool is about projects, builders, localities or a place, and the customer is not signed in
 *   (login wall, ADR-171; a guest may search homes). The model tells them to sign in, with the sign-in button, and does not
 *   list from memory.
 *
 * The propose tools (ADR-128 section 5.3) refuse with three more, thrown as a `ToolRefusal`. Each is one code for
 * every reason behind it on purpose, so a refusal tells the model what to say and nothing about why:
 * - `not_available`: the home or project is not open for requests. It is the same answer for a home that was
 *   never listed, is waiting for review, was withdrawn, sold or rented, or whose builder is not active.
 * - `own_home`: the signed-in customer owns the home, so they cannot enquire about it.
 * - `date_out_of_range`: the visit day is not from today to a year ahead.
 *
 * The last five are the agent loop's own refusals (ADR-128 section 4.5), given instead of running the call:
 * - `timeout`: the tool did not answer within `TOOL_TIMEOUT_MS`.
 * - `too_many_calls`: more read calls than may run together in one round.
 * - `call_limit`: the calls for this customer message are used up.
 * - `call_alone`: a propose tool was mixed with other calls; ask for it alone in the next round.
 * - `content_limit`: the content calls of this message (2 of the 6) are used up; the other tools still work.
 * - `web_limit`: the web search of this message (1 of the 6, ADR-218) is used up; the other tools still work.
 *
 * And one the web search throws on purpose (ADR-218):
 * - `site_first`: no lookup on our own site gave a result earlier in this message; look there first.
 */
export const TOOL_ERROR_CODES = [
  "unknown_tool",
  "invalid_input",
  "unavailable",
  "sign_in_required",
  "not_available",
  "own_home",
  "date_out_of_range",
  "timeout",
  "too_many_calls",
  "call_limit",
  "call_alone",
  "content_limit",
  "web_limit",
  "site_first",
] as const;
export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

/**
 * A line for the model beside the loop's own refusals, so it knows what to do next. It is addressed to the
 * model, never shown to a customer, and holds no data. The older codes need none: their meaning is plain.
 */
export const TOOL_ERROR_HINTS: Partial<Record<ToolErrorCode, string>> = {
  sign_in_required:
    "This is for signed-in customers: projects, builders, localities and searching around a place. Homes can still be searched without signing in, by their filters. Tell the customer to sign in with their phone number for this, add the marker [[link:sign_in]], and ask them to send the request again after signing in. Do not name, list or guess any project, builder, locality or place from memory.",
  not_available:
    "That home or project is not open for requests. Do not try another id; tell the customer it is not available.",
  own_home: "The customer owns this home, so they cannot enquire about it. Tell them so.",
  date_out_of_range:
    "A visit day must be from today to one year ahead, in India time. Ask the customer for another day.",
  timeout: "That information isn't available right now. Do not retry it; answer without it.",
  too_many_calls: "Too many calls this round. Ask again next round if it is still needed.",
  call_limit: "No more calls are allowed for this message. Answer from what you already have.",
  call_alone: "This tool must be called alone. Call it again next round with no other call.",
  content_limit:
    "No more articles or questions can be looked up for this message. Answer from what you already have; the other tools still work.",
  web_limit:
    "The web search of this message is used up. Answer from what you already have; the other tools still work.",
  site_first:
    "Search the web only after a lookup on findsprop (the articles and questions, or the builder, project or home) gave its result for this message and did not answer the question. Look there first.",
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
