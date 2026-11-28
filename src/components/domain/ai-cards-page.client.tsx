"use client";

/**
 * AiCardsPage: the "page" of cards beside the AI chat (ADR-220), the cards of the answer the visitor is reading.
 * Purpose: the chat keeps only text; the cards of an answer sit here, one screen of compact cards that does not
 *   scroll (a screen too short for six cards scrolls the cards inside the page rather than cutting them off). When the visitor moves to another answer the page changes with a slide-and-fade. Owner: design system.
 *   It draws and animates; it fetches nothing and holds no conversation: the chat island says which page to show
 *   and draws the cards of any page it is asked for (`renderPage`).
 * Props: pageKey (the page being shown; a new key swaps the page), order (the page's place in the conversation: a
 *   newer page enters from below, an older one from above), renderPage (the cards of a page by key, used for the
 *   page shown and for the page that is leaving; lay them out with AiCardsPageList), answers (count, current,
 *   onSelect: the answers that brought cards; shown as dots with "Answer 2 of 4" when there are two or more),
 *   pages (count, current, onSelect: the pages of one answer when Show more added some; shown as numbers when there
 *   are two or more), leading (a control for the start of the indicator row, drawn below lg only: the phone pager's
 *   "Back to the chat"), className. AiCardsPageList takes layout ("list" one card under another, default | "grid"
 *   two mini cards to a row, for a phone or tablet).
 * Responsive: it fills the height it is given and never scrolls itself; up to six compact cards fit one screen. The
 *   box around it (a column at lg and up, a pane of the phone pager) decides the width. The indicator row is under
 *   the cards from lg and above them below lg, in one row with `leading`, so the cards get the height.
 * Accessibility: a labelled region is not needed (the chat names it); the dots and the page numbers are real buttons
 *   with names, the current one is `aria-current`. The page that is leaving is `aria-hidden` and `inert`. With reduced
 *   motion the swap is plain (no leaving page).
 * States: one answer, several answers, several pages, swapping (leaving page over the new one), empty (no cards: the
 *   caller draws its own line instead of this).
 * Dependencies: useSlideSwap, next-intl, cn; motion in src/styles/ai-cards.css.
 * Tests: ai-cards-page.test.tsx; Design Lab "AI cards page".
 * UX reference: none yet (owner decisions of 28 Nov 2026, AI_SEARCH_UI_CARDS_NOTES.md).
 */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useSlideSwap } from "@/lib/use-slide-swap";

type Position = {
  count: number;
  /** The one shown, counting from 0. */
  current: number;
  onSelect: (index: number) => void;
};

type AiCardsPageProps = {
  pageKey: string;
  order: number;
  renderPage: (key: string) => ReactNode;
  answers: Position;
  pages?: Position | undefined;
  leading?: ReactNode;
  className?: string;
};

/** The cards of one page: one under the other, or two to a row. Pass each card (or its skeleton) as a child. */
function AiCardsPageList({
  children,
  layout = "list",
}: {
  children: ReactNode[];
  layout?: "list" | "grid";
}) {
  return (
    <ul
      className={cn(layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2")}
      data-slot="ai-cards-list"
    >
      {children.map((child, index) => (
        <li key={index}>{child}</li>
      ))}
    </ul>
  );
}

function AiCardsPage({
  pageKey,
  order,
  renderPage,
  answers,
  pages,
  leading,
  className,
}: AiCardsPageProps) {
  const translate = useTranslations("ai.cardsPage");
  const { leavingKey, direction } = useSlideSwap(pageKey, order);
  const showPages = pages !== undefined && pages.count > 1;
  const showAnswers = answers.count > 1;
  return (
    <section
      data-slot="ai-cards-page"
      className={cn("flex h-full min-h-0 flex-col gap-3", className)}
    >
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {leavingKey !== null ? (
          <div
            key={leavingKey}
            data-ai-page="leave"
            data-direction={direction}
            aria-hidden="true"
            inert
            className="absolute inset-x-0 top-0"
          >
            {renderPage(leavingKey)}
          </div>
        ) : null}
        <div
          key={pageKey}
          data-ai-page={leavingKey !== null ? "enter" : "stay"}
          data-direction={direction}
        >
          {renderPage(pageKey)}
        </div>
      </div>
      {showAnswers || showPages || leading ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 max-lg:order-first",
            !(showAnswers || showPages) && "lg:hidden",
          )}
        >
          {leading ? <div className="lg:hidden">{leading}</div> : null}
          {showAnswers ? (
            <div className="flex items-center gap-3" data-slot="ai-cards-answers">
              <span className="text-caption font-bold text-muted">
                {translate("answerOf", { number: answers.current + 1, total: answers.count })}
              </span>
              <ul className="flex items-center">
                {Array.from({ length: answers.count }, (_, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      aria-label={translate("answerDot", { number: index + 1 })}
                      aria-current={index === answers.current ? "true" : undefined}
                      onClick={() => answers.onSelect(index)}
                      className="group/dot grid size-6 place-items-center rounded-pill outline-offset-0"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-pill transition-colors",
                          index === answers.current
                            ? "bg-primary"
                            : "bg-line-strong group-hover/dot:bg-ink",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <span />
          )}
          {showPages ? (
            <ul className="flex items-center gap-1" data-slot="ai-cards-pages">
              {Array.from({ length: pages.count }, (_, index) => (
                <li key={index}>
                  <button
                    type="button"
                    aria-label={translate("pageOf", { number: index + 1, total: pages.count })}
                    aria-current={index === pages.current ? "true" : undefined}
                    onClick={() => pages.onSelect(index)}
                    className={cn(
                      "grid h-6 min-w-6 place-items-center rounded-pill px-2 text-caption font-bold",
                      index === pages.current
                        ? "bg-primary text-on-primary"
                        : "text-muted hover:bg-canvas-sunken hover:text-ink",
                    )}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export { AiCardsPage, AiCardsPageList };
export type { AiCardsPageProps };
