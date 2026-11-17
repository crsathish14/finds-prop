/**
 * NearbySection: the homes a little further out, under the main results of a place search.
 * Purpose: when a place search finds only a few homes, the page adds this section ("Also near
 *   Velachery") with homes in the wider circle, nearest first, so the visitor is not left with a nearly
 *   empty page (ADR-131; OLA_MAPS_PLAN.md D5). Owner: design system. It holds no state and fetches
 *   nothing: the page passes the place, the wider distance, how many homes there are, and the cards.
 * Props: place (the name the visitor searched, already known to the page), radiusKm (the wider circle,
 *   such as 15), count (how many homes are in the section), view ("grid" | "list", as the main results),
 *   children (the cards, each with its distance), className.
 * Responsive: the same grid as the main results (1, 2 and 3 across by the width of the results area).
 * Accessibility: a labelled region named by its heading (an h2). The note under the heading says why
 *   these homes are here, so they are never mistaken for matches inside the first circle.
 * States: with homes, in the grid and the list layout. The page draws nothing at all when there are no
 *   homes further out (no empty box).
 * Dependencies: ResultsGrid, next-intl. Tests: nearby-section.test.tsx; Design Lab "Nearby homes"
 *   (ADR-131).
 * UX reference: none yet; drawn from the search results screen with existing parts, for the owner's
 *   approval from the CI pictures (OLA_MAPS_PLAN.md D5).
 */
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ResultsView } from "./results-bar";
import { ResultsGrid } from "./results-list";

type NearbySectionProps = {
  place: string;
  radiusKm: number;
  count: number;
  view?: ResultsView;
  children: ReactNode;
  className?: string;
};

function NearbySection({
  place,
  radiusKm,
  count,
  view = "grid",
  children,
  className,
}: NearbySectionProps) {
  const translate = useTranslations();
  const headingId = useId();
  return (
    <section
      data-slot="nearby-section"
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-5 border-t border-line pt-8", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-title text-ink">
          {translate("domain.nearby.title", { place })}
        </h2>
        <p className="text-small text-muted">
          {translate("domain.nearby.note", { count, radiusKm })}
        </p>
      </div>
      <ResultsGrid view={view}>{children}</ResultsGrid>
    </section>
  );
}

export { NearbySection };
export type { NearbySectionProps };
