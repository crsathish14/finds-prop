import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { ResultsGrid } from "@/components/domain/results-list";
import { Link } from "@/components/ui/link";

type RentProjectsSectionProps = {
  /** The searched area, when there is one: the heading then names it. */
  place?: string | undefined;
  /** Where "See all projects" leads: the projects page. */
  seeAllHref: string;
  /** The project cards, already made by the page (at most RENT_PROJECTS_MAX). */
  children: ReactNode;
};

/**
 * The projects for rent under the homes of a rent search (ADR-219): a heading, a link to the projects page and the
 * project cards in the results grid. The page draws nothing at all when no project fits (no empty box).
 */
export function RentProjectsSection({ place, seeAllHref, children }: RentProjectsSectionProps) {
  const translate = useTranslations();
  const headingId = useId();
  return (
    <section
      data-slot="rent-projects-section"
      aria-labelledby={headingId}
      className="flex flex-col gap-5 border-t border-line pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-title text-ink">
          {place === undefined
            ? translate("results.rentProjects.title")
            : translate("results.rentProjects.titleIn", { place })}
        </h2>
        <Link href={seeAllHref} variant="arrow">
          {translate("results.rentProjects.seeAll")}
        </Link>
      </div>
      <ResultsGrid view="grid">{children}</ResultsGrid>
    </section>
  );
}
