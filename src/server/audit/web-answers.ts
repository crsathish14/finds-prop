import "server-only";
import type { Json } from "@/types/database.types";
import { createAdminSupabase } from "../supabase/admin.server";
import { logger } from "../logger";

/**
 * The server's side of the assistant's web search (ADR-218): the admin's Web search switch, read on every message, and
 * the 7-day memory of web answers. The memory keeps only the search words the assistant wrote, the short answer and its
 * sources, never the customer's message or any detail of the customer. A customer asking may be anyone, and the table is
 * closed to every client role, so the server reads and writes it with the service role.
 *
 * Nothing here throws: a failed read of the switch is "off", a failed read of the memory is "nothing kept", and a failed
 * write is one log line with no text in it.
 */

export interface KeptSource {
  readonly title: string;
  readonly url: string;
}

export interface KeptAnswer {
  readonly answer: string;
  readonly sources: readonly KeptSource[];
  readonly expiresAt: Date;
  readonly timesUsed: number;
}

export interface WebAnswerStore {
  /** Whether the admin's Web search switch is on now. False when it cannot be read. */
  webSearchOn(): Promise<boolean>;
  /** The answer kept for these search words (by their key), fresh or not, or null. */
  find(queryKey: string): Promise<KeptAnswer | null>;
  /** Counts one more use of a kept answer. */
  markUsed(queryKey: string, timesUsedBefore: number): Promise<void>;
  /** Keeps (or replaces) the answer for these search words until `expiresAt`. */
  save(entry: {
    readonly queryKey: string;
    readonly query: string;
    readonly answer: string;
    readonly sources: readonly KeptSource[];
    readonly expiresAt: Date;
    /** The uses counted so far for these words (a fresh search of words asked before keeps counting); 0 when new. */
    readonly timesUsedBefore: number;
  }): Promise<void>;
}

const ROUTE = "ai-web-search";

function warn(message: string, error?: unknown): void {
  logger.warn(message, {
    route: ROUTE,
    ...(error === undefined
      ? { reason: "rejected" }
      : { reason: "unreachable", errorName: error instanceof Error ? error.name : typeof error }),
  });
}

/** The kept sources, keeping only well-formed entries. */
function sourcesOf(value: Json): KeptSource[] {
  if (!Array.isArray(value)) return [];
  const sources: KeptSource[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { title, url } = entry;
    if (typeof url === "string")
      sources.push({ title: typeof title === "string" ? title : "", url });
  }
  return sources;
}

export const SERVER_WEB_ANSWER_STORE: WebAnswerStore = {
  async webSearchOn() {
    try {
      const { data, error } = await createAdminSupabase().rpc("ai_web_search_on");
      if (error) {
        warn("ai web search switch read failed");
        return false;
      }
      return data === true;
    } catch (error) {
      warn("ai web search switch read failed", error);
      return false;
    }
  },

  async find(queryKey) {
    try {
      const { data, error } = await createAdminSupabase()
        .from("ai_web_answers")
        .select("answer, sources, expires_at, times_used")
        .eq("query_key", queryKey)
        .maybeSingle();
      if (error) {
        warn("ai web answer read failed");
        return null;
      }
      if (data === null) return null;
      return {
        answer: data.answer,
        sources: sourcesOf(data.sources),
        expiresAt: new Date(data.expires_at),
        timesUsed: data.times_used,
      };
    } catch (error) {
      warn("ai web answer read failed", error);
      return null;
    }
  },

  async markUsed(queryKey, timesUsedBefore) {
    try {
      const { error } = await createAdminSupabase()
        .from("ai_web_answers")
        .update({ times_used: timesUsedBefore + 1, last_used_at: new Date().toISOString() })
        .eq("query_key", queryKey);
      if (error) warn("ai web answer use count failed");
    } catch (error) {
      warn("ai web answer use count failed", error);
    }
  },

  async save(entry) {
    try {
      const now = new Date().toISOString();
      const { error } = await createAdminSupabase()
        .from("ai_web_answers")
        .upsert(
          {
            query_key: entry.queryKey,
            query: entry.query,
            answer: entry.answer,
            sources: entry.sources.map((source) => ({ title: source.title, url: source.url })),
            searched_at: now,
            expires_at: entry.expiresAt.toISOString(),
            times_used: entry.timesUsedBefore + 1,
            last_used_at: now,
          },
          { onConflict: "query_key" },
        );
      if (error) warn("ai web answer save failed");
    } catch (error) {
      warn("ai web answer save failed", error);
    }
  },
};
