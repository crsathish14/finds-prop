import "server-only";
import { z } from "zod";
import { AI_MAX_CARDS_PER_ANSWER, TOOL_TIMEOUT_MS } from "@/config/ai";
import type { Translate } from "@/lib/format";
import { logger } from "@/server/logger";
import { signChatState, type ChatState, type RememberedSearch } from "../state/chat-state";
import { createTurnMemory } from "../state/memory";
import { runTool } from "../tools/run";
import type { AnyAiChatTool, CardReference, ToolOutcome } from "../tools/types";
import type { ChatStreamEvent } from "./events";
import { replyItem } from "./replies";
import { FALLBACK_HREF } from "./turn";

/**
 * The Show more button (ADR-206): the next page of the chat's current search, served from the requirements state with
 * no model call, so it costs nothing and never repeats a home. The search tool runs exactly as the model would call it,
 * with the remembered filters and `page: "next"`, so the page has the same filters, the same visibility and the same
 * ranking. The answer is one fixed line from `en.json` and the cards; nothing the model wrote is in it.
 */

/** The fixed lines of this answer, as `en.json` keys written out so the message check finds them. */
export const MORE_MESSAGE_KEYS = {
  homes: "ai.more.homes",
  projects: "ai.more.projects",
  none: "ai.more.none",
  fallback: "ai.fallback",
} as const;

/** The page a search result holds: its ids, how many it has shown so far and how many match. */
const pageSchema = z.object({
  total: z.number().nonnegative(),
  shownSoFar: z.number().nonnegative(),
  homes: z.array(z.object({ homeId: z.string() })).optional(),
  projects: z.array(z.object({ slug: z.string() })).optional(),
});

export type ShowMoreState = ChatState & { readonly search: RememberedSearch };

/** Whether a press of Show more can be served from this state: a remembered search of a tool this chat has. */
export function canShowMore(
  state: ChatState | null,
  tools: readonly AnyAiChatTool[],
): state is ShowMoreState {
  const search = state?.search ?? null;
  return search !== null && tools.some((tool) => tool.name === search.tool);
}

/** The tool call, given up after `TOOL_TIMEOUT_MS` like any call of the agent loop. */
async function runWithin(call: () => Promise<ToolOutcome>): Promise<ToolOutcome | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TOOL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([call(), late]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ShowMoreSummary {
  readonly outcome: "answered" | "fallback";
  readonly toolsRan: readonly string[];
}

export async function* showMoreEvents(input: {
  readonly tools: readonly AnyAiChatTool[];
  readonly translate: Translate;
  readonly signedIn: boolean;
  readonly state: ShowMoreState;
}): AsyncGenerator<ChatStreamEvent, ShowMoreSummary> {
  const { translate, state } = input;
  const search = state.search;
  const memory = createTurnMemory(state);
  const outcome = await runWithin(() =>
    runTool(
      input.tools,
      { name: search.tool, input: { ...search.filters, page: "next" } },
      { translate, locale: "en", signedIn: input.signedIn, search: memory },
    ),
  );
  const page = outcome?.status === "ok" ? pageSchema.safeParse(outcome.output) : null;
  if (outcome === null || outcome.status !== "ok" || page === null || !page.success) {
    logger.warn("ai chat show more could not be served", {
      code: outcome === null ? "timeout" : outcome.status === "ok" ? "shape" : outcome.code,
    });
    yield {
      type: "replace",
      key: MORE_MESSAGE_KEYS.fallback,
      text: translate(MORE_MESSAGE_KEYS.fallback),
      href: FALLBACK_HREF,
    };
    return { outcome: "fallback", toolsRan: [search.tool] };
  }

  // The cards of this page only: the slightly-above-budget home is not part of the ranked list.
  const homes = search.tool === "search_properties";
  const ids = new Set(
    homes
      ? (page.data.homes ?? []).map((home) => home.homeId)
      : (page.data.projects ?? []).map((project) => project.slug),
  );
  const cards = outcome.references
    .filter(
      (reference): reference is CardReference =>
        (reference.kind === "home" && ids.has(reference.homeId)) ||
        (reference.kind === "project" && ids.has(reference.slug)),
    )
    .slice(0, AI_MAX_CARDS_PER_ANSWER);
  const values = { count: cards.length, shown: page.data.shownSoFar, total: page.data.total };
  const key =
    cards.length === 0
      ? MORE_MESSAGE_KEYS.none
      : homes
        ? MORE_MESSAGE_KEYS.homes
        : MORE_MESSAGE_KEYS.projects;
  yield { type: "text", text: translate(key, values) };
  for (const reference of cards) yield { type: "card", reference };

  const current = memory.current();
  const more = current !== null && current.total > current.shown.length;
  const replies = [
    ...(homes && cards.length > 1 ? [replyItem("compareHomes", translate)] : []),
    ...(more && cards.length > 0 ? [replyItem("showMore", translate)] : []),
  ];
  if (replies.length > 0) yield { type: "replies", items: replies };
  const token = signChatState(memory.next());
  if (token !== null) yield { type: "state", token };
  return { outcome: "answered", toolsRan: [search.tool] };
}
