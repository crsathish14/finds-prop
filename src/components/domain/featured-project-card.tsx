/**
 * FeaturedProjectCard: one sponsored project as a large card in the homes and projects lists, the Featured project card
 * (concept C, ADR-192).
 * Purpose: shows a project of a builder or agent the admin picked, drawn only from what they uploaded: a big photo with
 *   two more beside it, the developer, the project, the homes, the size range, RERA, three highlights and the price,
 *   with "Request a call back" (the project's enquiry form) and "View project". An amber ring and a "Featured project"
 *   ribbon set it apart from the listings; "Sponsored" says it is paid for. Owner: design system. It holds no state;
 *   the page decides where it goes (after the sixth result) and which project it is.
 * Props: project (FeaturedProjectCardData: href, name, developerName, developerLogo, locality, bedrooms, areaMinSqft,
 *   areaMaxSqft, priceRupees, priceType, status, possession, rera, highlights, photos, photoCount), className.
 * Responsive: one column on phones (the photos on top), the photos beside the details from 768 px. It spans the whole
 *   row of the list it sits in.
 * Accessibility: the project name is a heading; the photos are decoration (the details say what matters); both links
 *   name where they go; the ribbon and "Sponsored" are text, never colour alone.
 * States: with three photos and more, one photo, none (the neutral ground shows); with and without logo, size range,
 *   RERA, highlights and price; a long name.
 * Dependencies: next/image, NextLink, Icon, format helpers, next-intl. Tests: featured-project-card.test.tsx; Design Lab
 *   "Ads" (Featured project card).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (concept C).
 */
import { ArrowRight, BadgeCheck, Check, MapPin, Phone, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import NextLink from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatArea, formatMonth, formatPrice, type Translate } from "@/lib/format";

type FeaturedPriceType =
  "per_sqft" | "basic" | "all_inclusive" | "rent_per_month" | "rent_per_sqft_month";

type FeaturedProjectCardData = {
  href: string;
  name: string;
  developerName: string;
  developerLogo: string | null;
  locality: string;
  bedrooms: number[];
  areaMinSqft: number | null;
  areaMaxSqft: number | null;
  priceRupees: number | null;
  priceType: FeaturedPriceType | null;
  status: "new_launch" | "under_construction" | "ready_to_move" | null;
  possession: string | null;
  rera: boolean;
  highlights: string[];
  photos: string[];
  photoCount: number;
};

type FeaturedProjectCardProps = {
  project: FeaturedProjectCardData;
  className?: string;
};

const PRICE_TYPE_KEYS = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
} as const satisfies Record<FeaturedPriceType, string>;

const STATUS_KEYS = {
  new_launch: "domain.projectCard.status.newLaunch",
  under_construction: "domain.projectCard.status.underConstruction",
  ready_to_move: "domain.projectCard.status.readyToMove",
} as const;

/** Two letters for the developer's mark: the first letters of the first two words. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** The enquiry form of a project page. */
const ENQUIRY_ANCHOR = "#enquiry";

/** A drawn sample (the Design Lab's SVG photos) is shown as it is: image optimisation takes no SVG. */
const isDrawing = (src: string) => src.endsWith(".svg");

const BUTTON =
  "inline-flex h-(--size-btn-sm) min-w-0 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-small font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:flex-none";

function FeaturedProjectCard({ project, className }: FeaturedProjectCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const sizes = [...new Set(project.bedrooms)]
    .filter((size) => size > 0)
    .sort((smaller, larger) => smaller - larger);
  const homes =
    sizes.length > 0 ? translate("domain.featuredProject.bhk", { sizes: sizes.join(", ") }) : null;
  const area =
    project.areaMinSqft && project.areaMaxSqft && project.areaMaxSqft > project.areaMinSqft
      ? translate("domain.featuredProject.areaRange", {
          from: formatArea(translate, locale, project.areaMinSqft),
          to: formatArea(translate, locale, project.areaMaxSqft),
        })
      : project.areaMinSqft
        ? formatArea(translate, locale, project.areaMinSqft)
        : null;
  let price: string | null = null;
  if (project.priceRupees) {
    const amount = formatPrice(translate, locale, project.priceRupees);
    price = project.priceType
      ? translate(PRICE_TYPE_KEYS[project.priceType], { price: amount })
      : amount;
  }
  const highlights = [
    ...project.highlights,
    ...(project.possession
      ? [
          translate("domain.featuredProject.possession", {
            date: formatMonth(locale, project.possession),
          }),
        ]
      : []),
  ].slice(0, 3);
  const [first, ...more] = project.photos;
  const extra = Math.max(0, project.photoCount - project.photos.length);

  return (
    <article
      data-slot="featured-project-card"
      className={cn(
        "relative grid overflow-hidden rounded-xl border-2 border-amber bg-surface shadow-card md:grid-cols-[1.05fr_1fr]",
        className,
      )}
    >
      <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-pill bg-amber px-3 py-1 text-caption font-bold text-on-amber">
        <Icon icon={Star} size="sm" />
        {translate("domain.featuredProject.ribbon")}
      </span>
      <div className="grid gap-1 p-1">
        <div className="relative aspect-16/10 overflow-hidden rounded-lg bg-canvas-sunken">
          {first ? (
            <Image
              src={first}
              alt=""
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              unoptimized={isDrawing(first)}
              className="object-cover"
            />
          ) : null}
        </div>
        {more.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {more.map((photo) => (
              <div
                key={photo}
                className="relative aspect-4/3 overflow-hidden rounded-md bg-canvas-sunken"
              >
                <Image
                  src={photo}
                  alt=""
                  fill
                  sizes="160px"
                  unoptimized={isDrawing(photo)}
                  className="object-cover"
                />
              </div>
            ))}
            {extra > 0 ? (
              <div className="grid aspect-4/3 place-items-center rounded-md bg-canvas-sunken text-caption font-bold text-ink">
                {translate("domain.featuredProject.morePhotos", { count: extra })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4 md:p-5">
        <div className="flex min-w-0 items-center gap-2 text-small font-semibold text-ink">
          {project.developerLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- an uploaded logo of any shape, shown whole and small
            <img
              src={project.developerLogo}
              alt=""
              className="size-8 shrink-0 rounded-md border border-line bg-surface object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-dark text-caption font-bold text-on-dark-accent"
            >
              {initialsOf(project.developerName)}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{project.developerName}</span>
          <span className="text-overline text-muted">
            {translate("domain.featuredProject.sponsored")}
          </span>
        </div>
        <h3 className="text-h3 text-ink">{project.name}</h3>
        <p className="flex items-center gap-1 text-small text-muted">
          <Icon icon={MapPin} size="sm" className="shrink-0" />
          <span className="truncate">{project.locality}</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {homes ? (
            <li className="rounded-pill bg-canvas-sunken px-3 py-1 text-caption font-semibold text-ink">
              {homes}
            </li>
          ) : null}
          {area ? (
            <li className="rounded-pill bg-canvas-sunken px-3 py-1 text-caption font-semibold text-ink">
              {area}
            </li>
          ) : null}
          {project.status ? (
            <li className="rounded-pill bg-canvas-sunken px-3 py-1 text-caption font-semibold text-ink">
              {translate(STATUS_KEYS[project.status])}
            </li>
          ) : null}
          {project.rera ? (
            <li className="inline-flex items-center gap-1 rounded-pill bg-primary-tint px-3 py-1 text-caption font-semibold text-primary">
              <Icon icon={BadgeCheck} size="sm" />
              {translate("domain.featuredProject.rera")}
            </li>
          ) : null}
        </ul>
        {highlights.length > 0 ? (
          <ul className="flex flex-col gap-1 text-small text-muted">
            {highlights.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Icon icon={Check} size="sm" className="mt-1 shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {price ? <p className="text-h3 text-ink tabular-nums">{price}</p> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <NextLink
            href={project.href + ENQUIRY_ANCHOR}
            className={cn(BUTTON, "bg-primary text-on-primary hover:bg-primary-hover")}
          >
            <Icon icon={Phone} size="sm" />
            {translate("domain.featuredProject.callBack")}
          </NextLink>
          <NextLink
            href={project.href}
            className={cn(
              BUTTON,
              "border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
            )}
          >
            {translate("domain.featuredProject.view")}
            <Icon icon={ArrowRight} size="sm" />
          </NextLink>
        </div>
      </div>
    </article>
  );
}

export { FeaturedProjectCard };
export type { FeaturedProjectCardData, FeaturedProjectCardProps };
