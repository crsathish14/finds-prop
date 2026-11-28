"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AI_MAX_CARDS_PER_ANSWER } from "@/config/ai";
import { readChatCardsAction } from "../actions";
import type { ChatCardView } from "../chat-cards";
import type { ChatReference } from "./chat-model";

/**
 * The heart and the Compare control of a home card. They are client components of the saved and compare features,
 * whose indexes also hold server code, so the server screen passes them in (`chat-screen.tsx`) and this island never
 * imports those features itself.
 */
export type ChatCardControls = {
  Save: ComponentType<{ shortId: string }>;
  Compare: ComponentType<{ shortId: string; title: string; cover: string | null }>;
  /** The compare bar of the chat: reports the ticked homes' ids and links to the comparison. Absent in tests that need neither. */
  CompareBar?: ComponentType<{ onIds: (ids: readonly string[]) => void }>;
};

/** Cards already fetched in this tab, by their references, so an answer that finishes or is restored does not fetch them again. */
const fetched = new Map<string, readonly ChatCardView[]>();

/** Reads under way, by their references, so two parts of the screen asking for the same cards make one request. */
const pending = new Map<string, Promise<readonly ChatCardView[] | null>>();

function readCards(wanted: string, list: ChatReference[]): Promise<readonly ChatCardView[] | null> {
  const cached = fetched.get(wanted);
  if (cached !== undefined) return Promise.resolve(cached);
  const running = pending.get(wanted);
  if (running !== undefined) return running;
  const request = readChatCardsAction({ references: list })
    .then((result) => {
      if (!result.ok) return null;
      if (fetched.size >= 50) fetched.clear();
      fetched.set(wanted, result.data);
      return result.data;
    })
    // A failed read leaves the answer's text on its own.
    .catch(() => null)
    .finally(() => pending.delete(wanted));
  pending.set(wanted, request);
  return request;
}

/**
 * The facts of the cards an answer names. The answer only carries references; the server reads the facts from the
 * public pages' own reads, so a card cannot show more than its page does, and the link of each card is built there
 * from the id the database returned, never from model text. `cards` is empty while they load and if they cannot be
 * read (`failed`), so the answer's text stands alone.
 */
export function useChatCards(references: readonly ChatReference[]): {
  cards: readonly ChatCardView[];
  failed: boolean;
} {
  const wanted = JSON.stringify(references.slice(0, AI_MAX_CARDS_PER_ANSWER));
  const [state, setState] = useState<{
    wanted: string;
    cards: readonly ChatCardView[];
    failed: boolean;
  }>(() => ({ wanted, cards: fetched.get(wanted) ?? [], failed: false }));

  useEffect(() => {
    let current = true;
    const list = JSON.parse(wanted) as ChatReference[];
    if (list.length === 0) return;
    // Already read for this answer: the first render took them from the cache.
    if (fetched.has(wanted)) return;
    void readCards(wanted, list).then((cards) => {
      if (!current) return;
      setState(
        cards === null ? { wanted, cards: [], failed: true } : { wanted, cards, failed: false },
      );
    });
    return () => {
      current = false;
    };
  }, [wanted]);

  const cached = fetched.get(wanted);
  if (cached !== undefined) return { cards: cached, failed: false };
  // Only what was read for these references: never the cards of an earlier list.
  return state.wanted === wanted
    ? { cards: state.cards, failed: state.failed }
    : { cards: [], failed: false };
}
