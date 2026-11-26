import "server-only";
import type { Json } from "@/types/database.types";
import { createAdminSupabase } from "../supabase/admin.server";
import { logger } from "../logger";

/**
 * The server's side of builder research (AI search Phase 4): what the assistant may read for a builder (the website on
 * the profile and the builder's extra pages), the saved copies of pages read in the last 7 days, and the log of every
 * page check and read that the builder and the admin see. A buyer asking about a builder may be a visitor, who can read
 * none of these tables, so the server reads and writes them with the service role.
 *
 * Nothing here throws: research is a side road of an answer. A failure is one log line with no page text, and the
 * research goes on as if there were no saved copy (or, for the setup, as if nothing could be read).
 *
 * The values are plain here (server code does not import features); src/features/builder-research narrows them, and
 * the database checks topics and problems against its own lists.
 */

export interface StoredLink {
  readonly href: string;
  readonly text: string;
}

export interface StoredExtraPage {
  readonly url: string;
  readonly topic: string;
}

export interface ResearchSetup {
  readonly website: string | null;
  readonly pages: readonly StoredExtraPage[];
}

export interface SavedCopy {
  readonly url: string;
  readonly title: string;
  readonly body: string;
  readonly links: readonly StoredLink[];
}

export interface ResearchStore {
  /** The website and the extra pages of a builder; null when there is no such builder or it cannot be read. */
  setup(builderId: string): Promise<ResearchSetup | null>;
  /** The copies of these pages read since `since`, by page key. */
  saved(builderId: string, keys: readonly string[], since: Date): Promise<Map<string, SavedCopy>>;
  /** Saves (or replaces) the copy of one page, read now. */
  save(builderId: string, key: string, copy: SavedCopy): Promise<void>;
  /** One line of the log: a check when a builder saved a page, or a read for a buyer's question. */
  record(
    builderId: string,
    url: string,
    kind: "check" | "read",
    problem: string | null,
  ): Promise<void>;
}

const ROUTE = "builder-research";

function warn(message: string, error?: unknown): void {
  logger.warn(message, {
    route: ROUTE,
    ...(error === undefined
      ? { reason: "rejected" }
      : { reason: "unreachable", errorName: error instanceof Error ? error.name : typeof error }),
  });
}

/** The saved links, keeping only well-formed entries. */
function linksOf(value: Json): StoredLink[] {
  if (!Array.isArray(value)) return [];
  const links: StoredLink[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { href, text } = entry;
    if (typeof href === "string") links.push({ href, text: typeof text === "string" ? text : "" });
  }
  return links;
}

export const SERVER_RESEARCH_STORE: ResearchStore = {
  async setup(builderId) {
    try {
      const client = createAdminSupabase();
      const [builder, links] = await Promise.all([
        client.from("builders").select("website").eq("id", builderId).maybeSingle(),
        client
          .from("builder_research_links")
          .select("url, topic, position")
          .eq("builder_id", builderId)
          .order("position"),
      ]);
      if (builder.error || links.error) {
        warn("builder research setup failed");
        return null;
      }
      if (builder.data === null) return null;
      return {
        website: builder.data.website,
        pages: (links.data ?? []).map((link) => ({ url: link.url, topic: link.topic })),
      };
    } catch (error) {
      warn("builder research setup failed", error);
      return null;
    }
  },

  async saved(builderId, keys, since) {
    const copies = new Map<string, SavedCopy>();
    if (keys.length === 0) return copies;
    try {
      const { data, error } = await createAdminSupabase()
        .from("builder_research_pages")
        .select("page_key, url, title, body, links")
        .eq("builder_id", builderId)
        .in("page_key", [...keys])
        .gte("read_at", since.toISOString());
      if (error) {
        warn("builder research copies read failed");
        return copies;
      }
      for (const row of data ?? []) {
        copies.set(row.page_key, {
          url: row.url,
          title: row.title,
          body: row.body,
          links: linksOf(row.links),
        });
      }
    } catch (error) {
      warn("builder research copies read failed", error);
    }
    return copies;
  },

  async save(builderId, key, copy) {
    try {
      const { error } = await createAdminSupabase()
        .from("builder_research_pages")
        .upsert({
          builder_id: builderId,
          page_key: key,
          url: copy.url,
          title: copy.title,
          body: copy.body,
          links: copy.links.map((link) => ({ href: link.href, text: link.text })),
          read_at: new Date().toISOString(),
        });
      if (error) warn("builder research copy save failed");
    } catch (error) {
      warn("builder research copy save failed", error);
    }
  },

  async record(builderId, url, kind, problem) {
    try {
      const { error } = await createAdminSupabase().rpc("record_builder_research_read", {
        p_builder: builderId,
        p_url: url,
        p_kind: kind,
        p_ok: problem === null,
        ...(problem === null ? {} : { p_problem: problem }),
      });
      if (error) warn("builder research log write failed");
    } catch (error) {
      warn("builder research log write failed", error);
    }
  },
};
