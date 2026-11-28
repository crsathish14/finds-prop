"use client";

import { useTranslations } from "next-intl";
import { AiCardsPage, AiCardsPageList } from "@/components/domain/ai-cards-page.client";
import { ProjectCard, ProjectCardSkeleton } from "@/components/domain/project-card";
import { PropertyCard, PropertyCardSkeleton } from "@/components/domain/property-card";
import { AI_MAX_CARDS_PER_ANSWER } from "@/config/ai";
import { useChatCards, type ChatCardControls } from "./answer-cards.client";
import { groupIndexOfAnswer, pageIndexOfAnswer, type AnswerGroup } from "./chat-pages";
import type { ChatReference } from "./chat-model";

/** The compact cards of one page: skeletons of the right number and kind while they load, then the cards. */
function PageCards({
  references,
  controls,
}: {
  references: readonly ChatReference[];
  controls: ChatCardControls;
}) {
  const { cards } = useChatCards(references);
  const { Save, Compare } = controls;
  const shown = references.slice(0, AI_MAX_CARDS_PER_ANSWER);
  // Until the facts arrive each card has its box already (its kind is known from the reference), so nothing pops in.
  if (cards.length === 0) {
    return (
      <AiCardsPageList>
        {shown.map((reference, index) =>
          reference.kind === "home" ? (
            <PropertyCardSkeleton key={index} layout="compact" />
          ) : (
            <ProjectCardSkeleton key={index} layout="compact" />
          ),
        )}
      </AiCardsPageList>
    );
  }
  return (
    <AiCardsPageList>
      {cards.map((entry, index) =>
        entry.kind === "home" ? (
          <PropertyCard
            key={entry.key}
            layout="compact"
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
          <ProjectCard
            key={entry.key}
            layout="compact"
            project={entry.card}
            priority={index === 0}
          />
        ),
      )}
    </AiCardsPageList>
  );
}

/**
 * The cards page beside the chat at lg and up (ADR-220): the cards of the answer the visitor is on, from the groups
 * the conversation makes. It draws what `AiCardsPage` is given; which answer is active and how the chat scrolls to
 * another one belong to the chat island. Before any cards exist it shows one quiet line.
 */
export function ChatCardsPane({
  groups,
  activeAnswerId,
  controls,
  onShowAnswer,
}: {
  groups: readonly AnswerGroup[];
  activeAnswerId: string | null;
  controls: ChatCardControls;
  /** Brings an answer of the chat into view (and so its cards onto the page). */
  onShowAnswer: (answerId: string) => void;
}) {
  const translate = useTranslations("ai.cardsPage");
  const groupIndex = activeAnswerId === null ? -1 : groupIndexOfAnswer(groups, activeAnswerId);
  const group = groups[groupIndex];
  if (group === undefined || activeAnswerId === null) {
    return (
      <p className="max-w-[40ch] text-small text-muted" data-slot="ai-cards-empty">
        {translate("empty")}
      </p>
    );
  }
  const pageIndex = Math.max(0, pageIndexOfAnswer(group, activeAnswerId));
  // The pages of every group in the order of the conversation: a newer page enters from below, an older from above.
  const before = groups
    .slice(0, groupIndex)
    .reduce((total, earlier) => total + earlier.pages.length, 0);
  const pageKey = group.answerIds[pageIndex] ?? group.id;
  return (
    <AiCardsPage
      pageKey={pageKey}
      order={before + pageIndex}
      renderPage={(key) => {
        const at = groups.find((entry) => entry.answerIds.includes(key));
        const references = at?.pages[at.answerIds.indexOf(key)];
        return references ? <PageCards references={references} controls={controls} /> : null;
      }}
      answers={{
        count: groups.length,
        current: groupIndex,
        onSelect: (index) => {
          const target = groups[index];
          if (target) onShowAnswer(target.id);
        },
      }}
      pages={{
        count: group.pages.length,
        current: pageIndex,
        onSelect: (index) => {
          const target = group.answerIds[index];
          if (target) onShowAnswer(target);
        },
      }}
    />
  );
}
