/**
 * ProjectCard: one new-build project in a grid.
 * Purpose: the card for the Projects page and the homepage's featured projects. Owner: design
 *   system. It holds no state and fetches nothing: the page passes the project's facts, already
 *   read from the database.
 * Props: project (href, name, developerName, locality, city, minRupees, maxRupees, bedrooms (the
 *   BHK sizes on offer, such as [2, 3]), status "new_launch" | "under_construction" |
 *   "ready_to_move", featured, cover { src, alt }), sizes (next/image `sizes` for this card's column),
 *   priority (first cards on the page), className. Missing facts are left out, never shown blank or
 *   as zero. One price is shown alone, two as a range.
 * Responsive: a column of picture over text at every width; the grid around it sets the columns.
 * Accessibility: the whole card is one link target: the project name link is stretched over the
 *   card. A keyboard ring is drawn around the card when that link has focus. The picture has the
 *   project's alt text. The place is "locality, city", or the locality alone when no city is given.
 * States: default, hover (shadow and a stronger border), focus, picture missing or failed
 *   (illustrated tile), loading (ProjectCardSkeleton).
 * Dependencies: Badge, Icon, Link, Skeleton, CardCover, format helpers, next-intl.
 * Tests: project-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: projects screen, project card and its loading state (c-cards.css .jcard).
 */
import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatPrice, type Translate } from "@/lib/format";
import { CardCover } from "./property-card-controls.client";

type ProjectStatus = "new_launch" | "under_construction" | "ready_to_move";

type ProjectCardData = {
  href: string;
  name: string;
  developerName?: string | undefined;
  locality: string;
  /** Leave empty when the project has no city of its own: the card then shows the locality alone. */
  city: string;
  minRupees?: number | null | undefined;
  maxRupees?: number | null | undefined;
  /** The BHK sizes on offer, such as [2, 3]. Order and repeats do not matter. */
  bedrooms?: readonly number[] | null | undefined;
  status?: ProjectStatus | null | undefined;
  featured?: boolean | undefined;
  cover?: { src: string; alt: string } | null | undefined;
};

type ProjectCardProps = {
  project: ProjectCardData;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

const STATUS_KEYS = {
  new_launch: "domain.projectCard.status.newLaunch",
  under_construction: "domain.projectCard.status.underConstruction",
  ready_to_move: "domain.projectCard.status.readyToMove",
} as const;

const DEFAULT_SIZES = "(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw";

function ProjectCard({
  project,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
}: ProjectCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const { minRupees, maxRupees } = project;
  const sizesOnOffer = [...new Set(project.bedrooms ?? [])].filter((size) => size > 0);
  sizesOnOffer.sort((smaller, larger) => smaller - larger);

  let price: string | null = null;
  if (minRupees && maxRupees && maxRupees !== minRupees) {
    price = translate("domain.projectCard.priceRange", {
      min: formatPrice(translate, locale, Math.min(minRupees, maxRupees)),
      max: formatPrice(translate, locale, Math.max(minRupees, maxRupees)),
    });
  } else if (minRupees || maxRupees) {
    price = formatPrice(translate, locale, (minRupees || maxRupees) as number);
  }

  return (
    <article
      data-slot="project-card"
      className={cn(
        "group/project relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
        "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
        "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
        className,
      )}
    >
      <div className="relative aspect-16/10 shrink-0 overflow-hidden bg-canvas-sunken">
        <CardCover
          src={project.cover?.src}
          alt={project.cover?.alt}
          sizes={sizes}
          priority={priority}
        />
        {project.featured || project.status ? (
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            {project.featured ? (
              <Badge tone="featured">{translate("domain.projectCard.featured")}</Badge>
            ) : null}
            {project.status ? (
              <Badge tone="outline">{translate(STATUS_KEYS[project.status])}</Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {project.developerName ? (
          <span className="text-overline text-cta-text">{project.developerName}</span>
        ) : null}
        <h3 className="text-h3 text-primary" data-slot="project-card-name">
          <Link
            href={project.href}
            data-stretched=""
            className="rounded-xs font-(weight:--display-weight) text-primary no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
          >
            {project.name}
          </Link>
        </h3>
        <p className="flex items-center gap-2 text-small text-muted">
          <Icon icon={MapPin} className="shrink-0 text-primary" />
          <span className="truncate">
            {project.city
              ? translate("domain.projectCard.location", {
                  locality: project.locality,
                  city: project.city,
                })
              : project.locality}
          </span>
        </p>
        {price ? <p className="text-title lining-nums">{price}</p> : null}
        {sizesOnOffer.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {sizesOnOffer.map((size) => (
              <li
                key={size}
                className="inline-flex h-7 items-center rounded-pill bg-canvas-sunken px-3 text-caption font-semibold text-ink"
              >
                {translate("property.bhk", { count: size })}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

/** The card while its data loads: the same box, so the page does not jump. */
function ProjectCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="project-card-skeleton"
      aria-hidden="true"
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
        className,
      )}
    >
      <Skeleton className="aspect-16/10 w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton shape="text" className="w-2/5" />
        <Skeleton shape="title" className="w-4/5" />
        <Skeleton shape="text" className="w-3/5" />
        <Skeleton shape="text" className="w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16 rounded-pill" />
          <Skeleton className="h-7 w-16 rounded-pill" />
        </div>
      </div>
    </div>
  );
}

export { ProjectCard, ProjectCardSkeleton };
export type { ProjectCardData, ProjectStatus };
