"use client";

/**
 * SpotlightProjects: the project cards of the Developer spotlight, a carousel on phones and a three-column grid from
 * 768 px. Purpose: the one moving part of the spotlight; the band around it stays a server component. Owner: design
 *   system.
 * Props: children (one card per item; each is put in its own list item).
 * Movement: an Embla carousel below 768 px, so it glides and settles like the other carousels: a swipe settles on one
 *   card and centres it, the first and last card stay at the ends with the band's padding, and the row runs to the
 *   band's edge. From 768 px Embla is switched off and the cards sit in a grid.
 * Responsive: below 768 px the row runs to the band's edge and the first card lines up with the band's padding; from
 *   768 px, three cards in a row.
 * Accessibility: a list of cards; every card is one link, so the row is reachable by keyboard and
 *   focusing a card scrolls it into view. Movement is instant under prefers-reduced-motion.
 * States: one, two or three cards (a row that fits does not move).
 * Dependencies: embla-carousel-react, usePrefersReducedMotion. Tests: developer-spotlight.test.tsx; Design Lab "Ads"
 *   (Developer spotlight).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (concept D), with the owner's
 *   request of 26 Nov 2026 to use the carousel library everywhere.
 */
import useEmblaCarousel from "embla-carousel-react";
import { Children, isValidElement, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type SpotlightProjectsProps = {
  children: ReactNode;
};

const GLIDE_DURATION = 25;
/** From this width the cards are a grid and the carousel is off. */
const GRID = "(min-width: 768px)";

function SpotlightProjects({ children }: SpotlightProjectsProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [viewport] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    duration: reducedMotion ? 0 : GLIDE_DURATION,
    breakpoints: { [GRID]: { active: false } },
  });
  const cards = Children.toArray(children);

  return (
    <div ref={viewport} className="-mx-5 overflow-hidden md:mx-0 md:overflow-visible">
      <ul className="flex touch-pan-y touch-pinch-zoom gap-3 ps-5 md:grid md:grid-cols-3 md:ps-0">
        {cards.map((card) => (
          // The gutter at the far end is the last card's margin: Embla reads the end gap from there.
          <li
            key={isValidElement(card) ? card.key : String(card)}
            className="w-[72%] flex-none last:me-5 md:w-auto md:last:me-0"
          >
            {card}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { SpotlightProjects };
