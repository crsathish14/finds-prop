import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  AI_CHAT_STATE_LIFETIME_SECONDS,
  AI_CHAT_STATE_MAX_CHARACTERS,
  AI_CHAT_STATE_MAX_OFFERED,
  AI_CHAT_STATE_MAX_SEEN,
} from "@/config/ai";
import { env } from "@/server/env";
import { logger } from "@/server/logger";

/**
 * The requirements state of the chat (ADR-206): what the assistant has to remember between two messages so that the
 * model never rebuilds it from the text of the last twelve. It is a token, `body.signature`, signed by the server the
 * same way as the proposals (`tools/proposal.ts`): an HMAC-SHA256 over a fixed label and the body, with the server-only
 * secret. The browser keeps it with the conversation and sends it back with the next message; the server checks it on
 * every message, and a token that was made up, changed, cut or has run out is ignored (the chat then simply has no
 * state), never trusted and never an error.
 *
 * What it holds, and nothing else (no person, no phone, no listing text):
 * - `search`: the last home or project search: the tool, its filters and preferences exactly as the tool took them,
 *   the ids it has shown so far in its ranked order (the pages already given) and how many match in all;
 * - `seen`: every home and project shown in this chat (`home:ID`, `project:SLUG`), so a new search can say which
 *   ones the customer saw before;
 * - `offered`: the homes and projects an enquiry or a site visit was already offered for, so it is not offered again.
 */

/** The label every signature starts with: it keeps this use of the secret apart from the proposals and the visitor hash. */
const SIGNATURE_LABEL = "findsprop.ai-chat.state.v1";
const SIGNATURE_BYTES = 32;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
/** A remembered record: `home:<id>` or `project:<slug>`. */
const RECORD_KEY = /^(home|project):[a-z0-9-]{1,160}$/;

/** The two searches whose results are paged and remembered. */
export const PAGED_SEARCH_TOOLS = ["search_properties", "search_projects"] as const;
export type PagedSearchTool = (typeof PAGED_SEARCH_TOOLS)[number];

const idSchema = z.string().min(1).max(160);

const searchSchema = z.strictObject({
  tool: z.enum(PAGED_SEARCH_TOOLS),
  /** The tool's input without its page: checked again by the tool's own schema whenever it is used. */
  filters: z.record(z.string(), z.unknown()),
  /** The ids given so far, in the ranked order (every page given). */
  shown: z.array(idSchema).max(AI_CHAT_STATE_MAX_SEEN),
  total: z.int().nonnegative(),
  /** True for a search around a place: the results page cannot show it, so there is no "See all" link. */
  place: z.boolean(),
});

const stateSchema = z.strictObject({
  version: z.literal(1),
  /** Seconds since 1970 (UTC) after which the state is no longer good. */
  expiresAt: z.int().positive(),
  search: searchSchema.nullable(),
  seen: z.array(z.string().regex(RECORD_KEY)).max(AI_CHAT_STATE_MAX_SEEN),
  offered: z.array(z.string().regex(RECORD_KEY)).max(AI_CHAT_STATE_MAX_OFFERED),
});

/** The state as it is signed and read back, without its time. */
export type ChatState = Omit<z.infer<typeof stateSchema>, "version" | "expiresAt">;
export type RememberedSearch = NonNullable<ChatState["search"]>;

export const EMPTY_CHAT_STATE: ChatState = { search: null, seen: [], offered: [] };

function signatureOf(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNATURE_LABEL}.${body}`).digest();
}

/** The bytes of a base64url text, or null when the text is not exactly what `toString("base64url")` writes. */
function decode(text: string): Buffer | null {
  if (!BASE64_URL.test(text)) return null;
  const bytes = Buffer.from(text, "base64url");
  return bytes.toString("base64url") === text ? bytes : null;
}

/** Keeps the newest entries of a list, each once, at most `max`. */
function newestUnique(list: readonly string[], max: number): string[] {
  const kept: string[] = [];
  for (const item of [...list].reverse()) {
    if (!kept.includes(item)) kept.push(item);
    if (kept.length >= max) break;
  }
  return kept.reverse();
}

/**
 * Signs the state for the browser to send back. Null when there is nothing to remember, when the secret is not set
 * (the chat then works without a state, as it did before), or when the token would be longer than the endpoint reads.
 */
export function signChatState(state: ChatState, now: Date = new Date()): string | null {
  if (state.search === null && state.seen.length === 0 && state.offered.length === 0) return null;
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  if (secret === undefined) {
    logger.error("ai chat state could not be signed, the secret is not set");
    return null;
  }
  const signed = {
    version: 1 as const,
    expiresAt: Math.floor(now.getTime() / 1000) + AI_CHAT_STATE_LIFETIME_SECONDS,
    search:
      state.search === null
        ? null
        : { ...state.search, shown: state.search.shown.slice(-AI_CHAT_STATE_MAX_SEEN) },
    seen: newestUnique(state.seen, AI_CHAT_STATE_MAX_SEEN),
    offered: newestUnique(state.offered, AI_CHAT_STATE_MAX_OFFERED),
  };
  // What does not fit the schema is never signed, so a token the server made always reads back.
  if (!stateSchema.safeParse(signed).success) return null;
  const body = Buffer.from(JSON.stringify(signed), "utf8").toString("base64url");
  const token = `${body}.${signatureOf(body, secret).toString("base64url")}`;
  return token.length <= AI_CHAT_STATE_MAX_CHARACTERS ? token : null;
}

/**
 * The state a token holds, or null. In order: the shape, the signature (compared in constant time), what the body
 * holds, and the time. Never throws: anything doubtful is no state.
 */
export function readChatState(token: unknown, now: Date = new Date()): ChatState | null {
  if (typeof token !== "string" || token.length > AI_CHAT_STATE_MAX_CHARACTERS) return null;
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  if (secret === undefined) return null;
  const parts = token.split(".");
  const [body, signature] = parts;
  if (parts.length !== 2 || body === undefined || signature === undefined) return null;
  const given = decode(signature);
  const bytes = decode(body);
  if (given === null || given.length !== SIGNATURE_BYTES || bytes === null) return null;
  if (!timingSafeEqual(given, signatureOf(body, secret))) return null;
  let parsed: z.ZodSafeParseResult<z.infer<typeof stateSchema>>;
  try {
    parsed = stateSchema.safeParse(JSON.parse(bytes.toString("utf8")));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  if (parsed.data.expiresAt * 1000 <= now.getTime()) return null;
  const { search, seen, offered } = parsed.data;
  return { search, seen, offered };
}
