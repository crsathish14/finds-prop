"use client";

/**
 * ScrollRow: a titled row of cards that scrolls sideways, with Previous and Next buttons.
 * Purpose: "Newest on Find Prop" on the homepage: more cards than fit, so the row scrolls instead
 *   of wrapping. Owner: design system. It holds the scroll position and nothing else: the page
 *   passes the title and the cards (property cards, as many as it has).
 * Props: title (see SectionHead), description, as ("h2" default | "h3"), label (already-translated
 *   name of the list for screen readers, such as "Newest homes"), children (one card each; each is
 *   put in its own list item), className.
 * Responsive: cards are 300 px wide, or 78% of the screen when that is less, and a little of the
 *   next one shows so a visitor can see there is more. The row runs to the screen edge while the
 *   first card lines up with the page's side padding. On a phone the visitor swipes and the
 *   buttons are hidden; from 768 px they show beside the title.
 * Accessibility: a list of cards, named by `label`. The buttons are named Previous and Next and
 *   are disabled at the ends. Every card holds links, so the row is reachable by keyboard; focusing
 *   a card scrolls it into view. Scrolling is instant under prefers-reduced-motion.
 * States: default, at the start (Previous disabled), at the end (Next disabled), one card only
 *   (both disabled), nothing to scroll (no cards: the whole row is left out).
 * Dependencies: SectionHead, IconButton, Icon, next-intl, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, Newest on Find Prop (s-home.css .hscroll). The UX does not draw the
 *   disabled state of the buttons; they are disabled at the ends, as the gallery arrows are.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { SectionHead } from "./section-head";

type ScrollRowProps = {
  title: string;
  description?: string | undefined;
  as?: "h2" | "h3" | undefined;
  label: string;
  children: ReactNode;
  className?: string;
};

/** How close to an end counts as being at it, in pixels (fractions of a pixel appear when zoomed). */
const END_SLACK = 2;
/** A press moves the row by this share of what is showing, so the card before it stays in view. */
const PAGE_SHARE = 0.8;

function ScrollRow({ title, description, as, label, children, className }: ScrollRowProps) {
  const translate = useTranslations();
  const rail = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const cards = Children.toArray(children);

  const measure = useCallback(() => {
    const node = rail.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= END_SLACK);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - END_SLACK);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, cards.length]);

  function move(direction: -1 | 1) {
    const node = rail.current;
    if (!node) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({
      left: direction * node.clientWidth * PAGE_SHARE,
      behavior: calm ? "auto" : "smooth",
    });
  }

  if (cards.length === 0) return null;

  return (
    <div data-slot="scroll-row" className={className}>
      <SectionHead
        title={title}
        description={description}
        as={as}
        action={
          <div className="hidden items-center gap-2 md:flex">
            <IconButton
              aria-label={translate("domain.scrollRow.previous")}
              disabled={atStart}
              onClick={() => move(-1)}
            >
              <Icon icon={ChevronLeft} size="lg" />
            </IconButton>
            <IconButton
              aria-label={translate("domain.scrollRow.next")}
              disabled={atEnd}
              onClick={() => move(1)}
            >
              <Icon icon={ChevronRight} size="lg" />
            </IconButton>
          </div>
        }
      />
      <ul
        ref={rail}
        aria-label={label}
        onScroll={measure}
        className={cn(
          "-mx-(--gutter) flex snap-x snap-proximity gap-4 overflow-x-auto px-gutter pt-1 pb-3",
          "scroll-px-(--gutter) [scrollbar-width:thin]",
        )}
      >
        {cards.map((card) => (
          // Children.toArray gives every element a key, so the cards keep their identity.
          <li
            key={isValidElement(card) ? card.key : String(card)}
            className="w-75 max-w-[78vw] flex-none snap-start"
          >
            {card}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ScrollRow };
