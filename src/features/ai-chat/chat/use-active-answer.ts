import { useEffect, useMemo, useState } from "react";
import { resolveCardsAnswer, type AnswerMarker } from "./chat-pages";

/** The attribute that marks an answer's element in the thread, so the page can tell which answer is in view. */
export const ANSWER_ID_ATTRIBUTE = "data-answer-id";

/** How much of an element must show for the observer to report a change, so a slow scroll moves the choice smoothly. */
const THRESHOLDS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

/**
 * The answer most in view: the one with the biggest share of its own height showing, and the newest of two that tie.
 * `order` lists the ids oldest first; an answer with nothing showing is never chosen.
 */
export function pickMostInView(
  ratios: ReadonlyMap<string, number>,
  order: readonly string[],
): string | null {
  let best: string | null = null;
  let bestRatio = 0;
  for (const id of order) {
    const ratio = ratios.get(id) ?? 0;
    // `>=`: a later answer with the same share wins, which is the newer one.
    if (ratio > 0 && ratio >= bestRatio) {
      best = id;
      bestRatio = ratio;
    }
  }
  return best;
}

/**
 * Which answer's cards the cards page shows (ADR-220): the answer being written while it streams; otherwise the
 * answer most in view as the visitor scrolls the chat (not the pointer), with an answer that has no cards keeping the
 * cards of the one before it. A restored chat, or one nothing has scrolled yet, starts on its last answer with cards.
 *
 * It watches the elements marked with `data-answer-id` that are in the page, so the thread only has to mark them.
 * Returns the id of an answer with cards, or null while there are none.
 */
export function useActiveAnswer(
  answers: readonly AnswerMarker[],
  inFlightId: string | null = null,
): string | null {
  const [viewed, setViewed] = useState<string | null>(null);
  // The effect restarts only when the list of answers changes, not on every render.
  const key = answers.map((answer) => answer.id).join(",");
  const order = useMemo(() => (key === "" ? [] : key.split(",")), [key]);

  useEffect(() => {
    if (order.length === 0 || typeof IntersectionObserver === "undefined") return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (changes) => {
        for (const change of changes) {
          const id = change.target.getAttribute(ANSWER_ID_ATTRIBUTE);
          if (id !== null) ratios.set(id, change.isIntersecting ? change.intersectionRatio : 0);
        }
        // Nothing showing at all (the answers are all out of sight) leaves the choice where it was.
        const best = pickMostInView(ratios, order);
        if (best !== null) setViewed(best);
      },
      { threshold: THRESHOLDS },
    );
    for (const element of document.querySelectorAll(`[${ANSWER_ID_ATTRIBUTE}]`)) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [order]);

  // While an answer is being written it is the one the page follows.
  const writing = inFlightId !== null && answers.some((answer) => answer.id === inFlightId);
  return resolveCardsAnswer(answers, writing ? inFlightId : viewed);
}
