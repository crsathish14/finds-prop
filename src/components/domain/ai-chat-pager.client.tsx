"use client";

/**
 * AiChatPager: the frame of the AI chat page (ADR-220): the chat and the cards page as two panes of a snapping pager
 *   below lg, and as two columns from lg.
 * Purpose: on a phone or tablet the chat and the cards page are two full-width panes side by side, and the visitor
 *   swipes sideways between them; the screen always settles fully on one (never half on each). From lg the same
 *   markup is a page with the chat on the left and the cards page on the right (the pager is switched off). The
 *   message box (`footer`) sits outside the panes, so it stays on screen on both. Owner: design system. It draws the
 *   frame and holds the pager; it holds no conversation: the chat island passes the panes and says which pane shows.
 * Props: chat (the chat column: the conversation, notices and the sign-in gate), cards (the cards page), footer (the
 *   compare bar and the message box, or nothing), pane (0 the chat, 1 the cards; the pager follows it), onPaneChange
 *   (called with the pane the visitor swiped or went back to), wide (true from lg, where both panes are shown and
 *   neither is `inert`), cardsLabel (already-translated name of the cards pane), chatRef (the chat pane's own scroll box, so the island can scroll the
 *   newest words into view), className.
 * Movement: an Embla carousel with two full-width slides, no free scrolling: a flick or a drag past about a third of
 *   the width changes pane, otherwise the pane springs back. Only sideways drags are the pager's; up and down is left
 *   to the browser, so the chat scrolls as usual (`touch-action: pan-y`). Instant under prefers-reduced-motion.
 * Responsive: below lg the frame is as tall as the screen between the header and the bottom bar (from md, the header
 *   and the bottom of the screen) and does not scroll itself: the chat pane scrolls inside its own box, and the
 *   message box is under both panes. From lg the page scrolls as before, the message box sticks to the bottom of the
 *   chat column, and the cards page is sticky between the header and the message box.
 * Accessibility: the pane that is not shown is `inert` (no focus, hidden from a screen reader), so a visitor never
 *   tabs into a pane they cannot see. The cards pane has a "Back to the chat" button (below lg only) and is named by
 *   `cardsLabel`. Pressing it, swiping and the chat's "on the right" line all go through `pane`.
 * States: chat shown, cards shown, dragging, from lg (two columns, pager off).
 * Dependencies: embla-carousel-react, Button, Icon, usePrefersReducedMotion, next-intl, cn.
 * Tests: ai-chat-pager.test.tsx; Design Lab "AI chat pager".
 * UX reference: none yet (owner decisions of 28 Nov 2026, AI_SEARCH_UI_CARDS_NOTES.md, A7 and A8).
 */
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type AiChatPane = 0 | 1;

type AiChatPagerProps = {
  chat: ReactNode;
  cards: ReactNode;
  footer?: ReactNode;
  pane: AiChatPane;
  onPaneChange: (pane: AiChatPane) => void;
  wide: boolean;
  cardsLabel: string;
  chatRef?: Ref<HTMLDivElement>;
  className?: string;
};

/** From this width the pager is off and the two panes are columns (the `lg` breakpoint). */
const WIDE = "(min-width: 1024px)";

/** Embla's own default easing time; 0 when the visitor asks for less motion. */
const GLIDE_DURATION = 25;

function AiChatPager({
  chat,
  cards,
  footer,
  pane,
  onPaneChange,
  wide,
  cardsLabel,
  chatRef,
  className,
}: AiChatPagerProps) {
  const translate = useTranslations("ai.pager");
  const reducedMotion = usePrefersReducedMotion();
  const [viewport, carousel] = useEmblaCarousel({
    axis: "x",
    align: "start",
    containScroll: false,
    dragFree: false,
    skipSnaps: false,
    duration: reducedMotion ? 0 : GLIDE_DURATION,
    // From lg the two panes are columns: the pager switches itself off and takes its movement with it.
    breakpoints: { [WIDE]: { active: false } },
  });
  const footerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const placed = useRef(false);

  // The visitor's swipe tells the island which pane is shown.
  useEffect(() => {
    if (!carousel) return;
    const api = carousel;
    function selected() {
      onPaneChange(api.selectedScrollSnap() === 1 ? 1 : 0);
    }
    api.on("select", selected).on("reInit", selected);
    return () => {
      api.off("select", selected).off("reInit", selected);
    };
  }, [carousel, onPaneChange]);

  // The island says another pane (the "on the right" line, the back button, a message sent from the cards): go there.
  useEffect(() => {
    if (!carousel || wide) return;
    // The first placement is instant, so a pager that starts on the cards pane does not slide to it.
    if (carousel.selectedScrollSnap() !== pane)
      carousel.scrollTo(pane, reducedMotion || !placed.current);
    placed.current = true;
  }, [carousel, pane, wide, reducedMotion]);

  // From lg the message box floats over the foot of the chat column (it sticks to the bottom of the screen), so the
  // chat column keeps as much room under its last line as the box is tall.
  const hasFooter = Boolean(footer);
  useEffect(() => {
    const box = footerRef.current;
    const frame = frameRef.current;
    if (!frame) return;
    if (!box || typeof ResizeObserver === "undefined") {
      frame.style.setProperty("--ai-composer-h", "0px");
      return;
    }
    const measure = () => frame.style.setProperty("--ai-composer-h", `${box.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [hasFooter]);

  return (
    <div
      ref={frameRef}
      data-slot="ai-chat-pager"
      data-pane={pane === 1 ? "cards" : "chat"}
      className={cn(
        "mx-auto flex w-full max-w-205 flex-col",
        // Below lg: exactly the screen between the header and the bottom bar, so the page itself never scrolls.
        "h-[calc(100dvh-var(--header-h)-var(--bottombar-h))] md:h-[calc(100dvh-var(--header-h))]",
        "lg:grid lg:h-auto lg:max-w-(--container-mid) lg:flex-1 lg:grid-cols-[32rem_minmax(0,1fr)] lg:gap-x-10 lg:px-gutter xl:grid-cols-[36rem_minmax(0,1fr)]",
        className,
      )}
    >
      <div ref={viewport} className="min-h-0 flex-1 overflow-hidden lg:contents">
        <div className="flex h-full touch-pan-y touch-pinch-zoom lg:contents">
          <div
            ref={chatRef}
            data-slot="ai-chat-pane"
            inert={!wide && pane !== 0}
            className={cn(
              "h-full min-w-0 flex-[0_0_100%] overflow-y-auto overscroll-y-contain",
              "lg:col-start-1 lg:row-start-1 lg:h-auto lg:overflow-visible lg:pb-(--ai-composer-h)",
            )}
          >
            {chat}
          </div>
          <aside
            aria-label={cardsLabel}
            data-slot="ai-cards-aside"
            inert={!wide && pane !== 1}
            className="h-full min-w-0 flex-[0_0_100%] lg:col-start-2 lg:row-start-1 lg:h-auto"
          >
            {/* From lg the page stays in view while the chat scrolls, between the header and the foot; it does not scroll itself. */}
            <div className="flex h-full flex-col gap-3 px-gutter py-4 md:py-6 lg:sticky lg:top-(--header-h) lg:h-[calc(100dvh-var(--header-h))] lg:px-0 lg:pt-10 lg:pb-24">
              <div className="lg:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconStart={<Icon icon={ArrowLeft} />}
                  onClick={() => onPaneChange(0)}
                  className="-ml-4"
                >
                  {translate("back")}
                </Button>
              </div>
              <div className="min-h-0 flex-1">{cards}</div>
            </div>
          </aside>
        </div>
      </div>
      {footer ? (
        <div
          ref={footerRef}
          data-slot="ai-chat-footer"
          className="shrink-0 bg-canvas px-gutter lg:sticky lg:bottom-0 lg:z-sticky lg:col-start-1 lg:row-start-1 lg:self-end lg:px-0"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export { AiChatPager };
export type { AiChatPagerProps, AiChatPane };
