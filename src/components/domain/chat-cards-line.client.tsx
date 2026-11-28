"use client";

/**
 * ChatCardsLine: the one quiet line under an AI answer that brought cards ("6 homes on the right", ADR-220).
 * Purpose: tells the visitor where the answer's cards went and brings them onto the cards page when pressed. Owner:
 *   design system. It holds no state.
 * Props: count (how many cards), kind ("homes" | "projects" | "properties", a mixed list), onShow (called when pressed).
 * Responsive: one line of text with an arrow; the same on every size (it is drawn at lg and up, where the cards page is).
 * Accessibility: a real button, at least 24 px tall. It sits in a polite live region, so a screen reader says it once
 *   when it appears (an answer that finishes writing) and not for the answers a restored chat draws all at once.
 * States: default, hover (underline), focus, hidden when there are no cards.
 * Dependencies: Icon, next-intl.
 * Tests: chat-cards-line.test.tsx; Design Lab "AI chat messages".
 * UX reference: none yet (owner decisions of 28 Nov 2026, AI_SEARCH_UI_CARDS_NOTES.md).
 */
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";

type ChatCardsLineProps = {
  count: number;
  kind: "homes" | "projects" | "properties";
  onShow: () => void;
};

function ChatCardsLine({ count, kind, onShow }: ChatCardsLineProps) {
  const translate = useTranslations("ai");
  return (
    <div aria-live="polite" data-slot="chat-cards-line">
      {count > 0 ? (
        <button
          type="button"
          onClick={onShow}
          className="inline-flex min-h-6 items-center gap-2 rounded-xs text-small font-semibold text-primary hover:underline"
        >
          {translate("cardsOnRight", { count, kind })}
          <Icon icon={ArrowRight} size="sm" />
        </button>
      ) : null}
    </div>
  );
}

export { ChatCardsLine };
