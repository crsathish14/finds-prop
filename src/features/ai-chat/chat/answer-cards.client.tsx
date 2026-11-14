"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ProjectCard } from "@/components/domain/project-card";
import { PropertyCard } from "@/components/domain/property-card";
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
};

/**
 * The cards under one answer: the approved property and project cards, with their heart and Compare controls,
 * unchanged (UX addendum decision 5). The answer only carries references; the server reads the facts from the public
 * pages' own reads, so a card cannot show more than its page does, and the link of each card is built there from the
 * id the database returned, never from model text. While the cards load, and if they cannot be read, the answer's
 * text stands alone.
 */
/** Cards already fetched in this tab, by their references, so an answer that finishes or is restored does not fetch them again. */
const fetched = new Map<string, readonly ChatCardView[]>();

export function AnswerCards({
  references,
  controls,
}: {
  references: readonly ChatReference[];
  controls: ChatCardControls;
}) {
  const [cards, setCards] = useState<readonly ChatCardView[]>(
    () => fetched.get(JSON.stringify(references.slice(0, AI_MAX_CARDS_PER_ANSWER))) ?? [],
  );
  const wanted = JSON.stringify(references.slice(0, AI_MAX_CARDS_PER_ANSWER));
  const { Save, Compare } = controls;

  useEffect(() => {
    let current = true;
    const list = JSON.parse(wanted) as ChatReference[];
    if (list.length === 0) return;
    // Already read for this answer: the first render took them from the cache.
    if (fetched.has(wanted)) return;
    readChatCardsAction({ references: list })
      .then((result) => {
        if (!result.ok) return;
        if (fetched.size >= 50) fetched.clear();
        fetched.set(wanted, result.data);
        if (current) setCards(result.data);
      })
      // A failed read leaves the answer's text on its own.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [wanted]);

  return (
    <>
      {cards.map((entry, index) =>
        entry.kind === "home" ? (
          <PropertyCard
            key={entry.key}
            property={entry.card}
            priority={index === 0}
            save={<Save shortId={entry.shortId} />}
            compare={
              <Compare
                shortId={entry.shortId}
                title={entry.card.title}
                cover={entry.card.cover?.src ?? null}
              />
            }
          />
        ) : (
          <ProjectCard key={entry.key} project={entry.card} priority={index === 0} />
        ),
      )}
    </>
  );
}
