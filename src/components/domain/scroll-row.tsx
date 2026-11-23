"use client";

/**
 * ScrollRow: a titled row of cards that glides sideways, with Previous and Next buttons and a
 *   progress bar under the cards.
 * Purpose: "Newest on Find Prop" on the homepage: more cards than fit, so the row scrolls instead
 *   of wrapping. Owner: design system. It holds the scroll position and nothing else: the page
 *   passes the title and the cards (property cards, as many as it has).
 * Props: title (see SectionHead), description, as ("h2" default | "h3"), id (the title's id, so a
 *   section around the row can be named by it), label (already-translated
 *   name of the list for screen readers, such as "Newest homes"), children (one card each; each is
 *   put in its own list item), className.
 * Movement: an Embla carousel, so every way of moving has the same easing: dragging with a finger
 *   or the mouse (the row keeps gliding after a flick), the buttons (one screenful at a time), a
 *   sideways trackpad swipe or Shift + mouse wheel (the row follows the wheel and eases to a stop).
 *   A plain up-down wheel still scrolls the page: the row never traps it.
 * Responsive: cards are 300 px wide, or 78% of the screen when that is less, and a little of the
 *   next one shows so a visitor can see there is more. The row runs to the screen edge while the
 *   first card lines up with the page's side padding. On a phone the visitor swipes and the
 *   buttons are hidden; from 768 px they show beside the title.
 * Progress bar: a thin bar under the row, in place of a scrollbar. It starts partly filled
 *   (MIN_FILL) and fills completely as the row reaches its end. Decorative (aria-hidden): the
 *   buttons and the list already say where the visitor is.
 * Accessibility: a list of cards, named by `label`. The buttons are named Previous and Next and
 *   are disabled at the ends. Every card holds links, so the row is reachable by keyboard; focusing
 *   a card scrolls it into view. Movement is instant under prefers-reduced-motion.
 * States: default, at the start (Previous disabled), at the end (Next disabled and the bar full),
 *   one card only (both disabled and no bar), nothing to scroll (no cards: the whole row is left
 *   out).
 * Dependencies: SectionHead, IconButton, Icon, embla-carousel-react, next-intl, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, Newest on Find Prop (s-home.css .hscroll). The UX draws a native
 *   scrollbar and does not draw the disabled buttons or a progress bar; the owner asked for the
 *   carousel and the bar on 23 Nov 2026.
 */
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
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
  id?: string | undefined;
  label: string;
  children: ReactNode;
  className?: string;
};

/** How close to an end counts as being at it, as a share of the whole way (zoomed screens). */
const END_SLACK = 0.005;
/** The bar is this full at the start, so a visitor sees a bar and not an empty track. */
const MIN_FILL = 0.15;
/** Embla's own default easing time; 0 when the visitor asks for less motion. */
const GLIDE_DURATION = 25;
/** One line of a mouse wheel that reports lines (Firefox) is about this many pixels. */
const LINE_HEIGHT = 16;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the visitor has asked their device for less motion. False while the page is built. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

function ScrollRow({ title, description, as, id, label, children, className }: ScrollRowProps) {
  const translate = useTranslations();
  const reducedMotion = usePrefersReducedMotion();
  const [viewport, carousel] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
    slidesToScroll: "auto",
    duration: reducedMotion ? 0 : GLIDE_DURATION,
  });
  const [progress, setProgress] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const cards = Children.toArray(children);

  const measure = useCallback(() => {
    if (!carousel) return;
    const fits = carousel.scrollSnapList().length <= 1;
    const share = fits ? 0 : Math.min(1, Math.max(0, carousel.scrollProgress()));
    // A thousandth is finer than any screen, and keeps the page from re-rendering for nothing.
    setProgress(Math.round(share * 1000) / 1000);
    setScrollable(!fits);
  }, [carousel]);

  useEffect(() => {
    if (!carousel) return;
    // Embla has already started by now, so its first events are missed: read the position once.
    const first = requestAnimationFrame(measure);
    carousel.on("scroll", measure).on("reInit", measure).on("resize", measure);
    return () => {
      cancelAnimationFrame(first);
      carousel.off("scroll", measure).off("reInit", measure).off("resize", measure);
    };
  }, [carousel, measure, cards.length]);

  // Embla ignores the wheel, so a sideways swipe (trackpad) or Shift + wheel is handed to its
  // engine as a distance: it eases the row there the same way it eases a flick. An up-down wheel
  // is left alone so the page keeps scrolling, and so is a swipe when the row is already at that end.
  useEffect(() => {
    if (!carousel) return;
    const api = carousel;
    const root = api.rootNode();
    function follow(event: WheelEvent) {
      const sideways =
        event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX || event.deltaY
          : 0;
      if (sideways === 0) return;
      const unit = event.deltaMode === 1 ? LINE_HEIGHT : 1;
      const engine = api.internalEngine();
      const stops = engine.scrollSnaps;
      const current = engine.target.get();
      const wanted = current - sideways * unit;
      const next = Math.min(Math.max(...stops), Math.max(Math.min(...stops), wanted));
      if (next === current) return;
      event.preventDefault();
      engine.scrollTo.distance(next - current, false);
    }
    root.addEventListener("wheel", follow, { passive: false });
    return () => root.removeEventListener("wheel", follow);
  }, [carousel]);

  if (cards.length === 0) return null;

  const atStart = !scrollable || progress <= END_SLACK;
  const atEnd = !scrollable || progress >= 1 - END_SLACK;
  const fill = MIN_FILL + (1 - MIN_FILL) * progress;

  return (
    <div data-slot="scroll-row" className={className}>
      <SectionHead
        title={title}
        description={description}
        as={as}
        id={id}
        action={
          <div className="hidden items-center gap-2 md:flex">
            <IconButton
              aria-label={translate("domain.scrollRow.previous")}
              disabled={atStart}
              onClick={() => carousel?.scrollPrev()}
            >
              <Icon icon={ChevronLeft} size="lg" />
            </IconButton>
            <IconButton
              aria-label={translate("domain.scrollRow.next")}
              disabled={atEnd}
              onClick={() => carousel?.scrollNext()}
            >
              <Icon icon={ChevronRight} size="lg" />
            </IconButton>
          </div>
        }
      />
      <div ref={viewport} className="-mx-(--gutter) overflow-hidden pt-1 pb-3">
        <ul
          aria-label={label}
          className="flex cursor-grab touch-pan-y touch-pinch-zoom gap-4 ps-gutter active:cursor-grabbing"
        >
          {cards.map((card) => (
            // Children.toArray gives every element a key, so the cards keep their identity. The
            // gutter at the far end is the last card's margin: Embla reads the end gap from there,
            // not from the list's padding, so the last card stops where the page's content stops.
            <li
              key={isValidElement(card) ? card.key : String(card)}
              className="w-75 max-w-[78vw] flex-none last:me-(--gutter)"
            >
              {card}
            </li>
          ))}
        </ul>
      </div>
      <div
        data-slot="scroll-row-progress"
        aria-hidden="true"
        className={cn("h-1 overflow-hidden rounded-pill bg-line", scrollable ? "" : "invisible")}
      >
        <div
          data-slot="scroll-row-progress-fill"
          style={{ width: `${fill * 100}%` }}
          className="h-full rounded-pill bg-primary"
        />
      </div>
    </div>
  );
}

export { ScrollRow };
