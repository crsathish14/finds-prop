import type { AssistantEntry, ChatEntry, ChatReference } from "./chat-model";

/**
 * The pages of the AI chat's cards page (ADR-220), worked out from the conversation. Pure: no browser, no React.
 *
 * Each answer that brought cards is one page of cards (up to six). An answer to Show more continues the answer it
 * belongs to (`moreOf`), so the two are one *group*: the cards page shows the group as the pages "1 2" of one answer
 * and the chat does not grow. An answer without cards (a sum, a builder's profile) is not a group: the cards page
 * keeps the cards of the answer before it.
 */

/** One answer's cards, with the answers that continued it with Show more. */
export type AnswerGroup = {
  /** The id of the first answer of the group; the group is known by it. */
  id: string;
  /** The answers of the group, the first one first. The same length as `pages`. */
  answerIds: string[];
  /** The references of each answer: one page of cards each. */
  pages: ChatReference[][];
};

/** What the chat needs to know about an answer to place it, finished or still being written. */
type PlacedAnswer = Pick<AssistantEntry, "id" | "references" | "replaced"> & {
  moreOf?: string | undefined;
};

/**
 * The groups of a conversation, oldest first. An answer joins the group named by its `moreOf` when that group exists;
 * an answer with no cards, or one that a fixed line replaced, is left out.
 */
export function buildAnswerGroups(
  entries: readonly ChatEntry[],
  live?: PlacedAnswer | null,
): AnswerGroup[] {
  const answers: PlacedAnswer[] = entries.flatMap((entry) =>
    entry.role === "assistant" ? [entry] : [],
  );
  if (live) answers.push(live);
  const groups: AnswerGroup[] = [];
  for (const answer of answers) {
    if (answer.replaced || answer.references.length === 0) continue;
    const parent =
      answer.moreOf === undefined ? undefined : groups.find((group) => group.id === answer.moreOf);
    if (parent) {
      parent.answerIds.push(answer.id);
      parent.pages.push([...answer.references]);
    } else {
      groups.push({ id: answer.id, answerIds: [answer.id], pages: [[...answer.references]] });
    }
  }
  return groups;
}

/** The place of the group an answer belongs to (a Show more answer belongs to the group it continues), or -1. */
export function groupIndexOfAnswer(groups: readonly AnswerGroup[], answerId: string): number {
  return groups.findIndex((group) => group.answerIds.includes(answerId));
}

/** The page of a group an answer is, or -1. */
export function pageIndexOfAnswer(group: AnswerGroup, answerId: string): number {
  return group.answerIds.indexOf(answerId);
}

/** The kind of cards a page holds, for the words "3 homes", "2 projects" and "5 properties" (a mixed list). */
export type CardsKind = "homes" | "projects" | "properties";

/** How many cards a page holds, and what to call them. */
export function describeCards(references: readonly ChatReference[]): {
  count: number;
  kind: CardsKind;
} {
  const homes = references.filter((reference) => reference.kind === "home").length;
  const projects = references.length - homes;
  const kind: CardsKind = projects === 0 ? "homes" : homes === 0 ? "projects" : "properties";
  return { count: references.length, kind };
}

/** What `resolveCardsAnswer` needs to know of each answer in the conversation, oldest first. */
export type AnswerMarker = { id: string; hasCards: boolean };

/**
 * The answer whose cards the page shows when the visitor is looking at `viewedId`. An answer with cards shows its own;
 * one without (EMI, a builder) keeps the cards of the nearest answer before it; before the first cards, the first
 * cards that come. The page never goes blank once any cards exist. Nothing in view yet: the last answer with cards.
 */
export function resolveCardsAnswer(
  answers: readonly AnswerMarker[],
  viewedId: string | null,
): string | null {
  const withCards = answers.filter((answer) => answer.hasCards);
  const last = withCards.at(-1);
  if (last === undefined) return null;
  const viewed = viewedId === null ? -1 : answers.findIndex((answer) => answer.id === viewedId);
  if (viewed === -1) return last.id;
  for (let index = viewed; index >= 0; index -= 1) {
    const answer = answers[index];
    if (answer?.hasCards) return answer.id;
  }
  return withCards[0]?.id ?? last.id;
}
