/**
 * DeveloperSpotlight: one sponsored builder or agent as a dark band on the home page, the Developer spotlight
 * (concept D, ADR-193).
 * Purpose: sells the developer's brand: their logo (or initials), name, tagline, how long they have built, how many
 *   projects they delivered, how many they list and launch on findsprop, a link to their website, and up to three of
 *   their live projects as small cards. Everything comes from what they uploaded; the admin only picks them.
 *   "Sponsored" says it is paid for. Owner: design system. It holds no state and fetches nothing: the page decides
 *   which developer it is (one per visit) and where it goes.
 * Props: developer (DeveloperSpotlightData: name, logo, about, years, delivered, listed, launching, website, projects:
 *   up to three of { href, name, locality, bedrooms, priceRupees, priceType, status, cover }), headingId (the id of the
 *   name, so the section around can be named by it), eyebrowId (the id of the "Developer spotlight" line), className.
 * Responsive: on phones the developer sits above the projects, which scroll sideways one card at a time; from 768 px
 *   the projects are three in a row; from 1024 px the developer sits beside them.
 * Accessibility: the name is a heading; the figures are a description list (the label read with its number); each
 *   project card is one link named by its heading; the pictures only decorate (empty alt text); the website link says
 *   it opens in a new tab and is marked sponsored. The card lift on hover is left out with reduced motion.
 * States: every detail, little given (no logo: initials; no tagline or figures: left out, never blank or zero), one
 *   project, a project with no cover (the dark ground shows), a long name.
 * Dependencies: next/image, NextLink, Icon, format helpers, next-intl. Tests: developer-spotlight.test.tsx; Design Lab
 *   "Ads" (Developer spotlight).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (concept D).
 */
import { ArrowUpRight, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import NextLink from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatPrice, type Translate } from "@/lib/format";

type SpotlightPriceType =
  "per_sqft" | "basic" | "all_inclusive" | "rent_per_month" | "rent_per_sqft_month";

type SpotlightStatus = "new_launch" | "under_construction" | "ready_to_move";

type DeveloperSpotlightProject = {
  href: string;
  name: string;
  locality: string;
  bedrooms: number[];
  priceRupees: number | null;
  priceType: SpotlightPriceType | null;
  status: SpotlightStatus | null;
  cover: string | null;
};

type DeveloperSpotlightData = {
  name: string;
  logo: string | null;
  about: string | null;
  years: number | null;
  delivered: number | null;
  listed: number;
  launching: number;
  website: string | null;
  projects: DeveloperSpotlightProject[];
};

type DeveloperSpotlightProps = {
  developer: DeveloperSpotlightData;
  headingId: string;
  eyebrowId: string;
  className?: string;
};

const PRICE_TYPE_KEYS = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
} as const satisfies Record<SpotlightPriceType, string>;

const STATUS_KEYS = {
  new_launch: "domain.projectCard.status.newLaunch",
  under_construction: "domain.projectCard.status.underConstruction",
  ready_to_move: "domain.projectCard.status.readyToMove",
} as const satisfies Record<SpotlightStatus, string>;

/** The most project cards shown. */
const PROJECTS_SHOWN = 3;

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

/** A drawn sample (the Design Lab's SVG photos) is shown as it is: image optimisation takes no SVG. */
const isDrawing = (src: string) => src.endsWith(".svg");

function ProjectCard({
  project,
  translate,
  locale,
}: {
  project: DeveloperSpotlightProject;
  translate: Translate;
  locale: string;
}) {
  const sizes = [...new Set(project.bedrooms)]
    .filter((size) => size > 0)
    .sort((smaller, larger) => smaller - larger);
  const homes =
    sizes.length > 0 ? translate("domain.featuredProject.bhk", { sizes: sizes.join(", ") }) : null;
  let price: string | null = null;
  if (project.priceRupees) {
    const amount = formatPrice(translate, locale, project.priceRupees);
    price = project.priceType
      ? translate(PRICE_TYPE_KEYS[project.priceType], { price: amount })
      : amount;
  }
  return (
    <li className="w-[72%] shrink-0 snap-start md:w-auto">
      <NextLink
        href={project.href}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-dark-line bg-dark-hover transition-[transform,border-color] duration-(--dur-fast) hover:border-on-dark-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark motion-safe:hover:-translate-y-1"
      >
        <div className="relative aspect-4/3 bg-dark-active">
          {project.cover ? (
            <Image
              src={project.cover}
              alt=""
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 70vw"
              unoptimized={isDrawing(project.cover)}
              className="object-cover"
            />
          ) : null}
          {project.status ? (
            <span className="absolute top-2 left-2 rounded-pill bg-surface px-2 py-1 text-caption font-bold text-ink">
              {translate(STATUS_KEYS[project.status])}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
          <h3 className="truncate text-title-sm text-on-dark">{project.name}</h3>
          <p className="flex min-w-0 items-center gap-1 text-caption text-on-dark-muted">
            <Icon icon={MapPin} size="sm" className="shrink-0" />
            <span className="truncate">
              {homes ? `${project.locality} · ${homes}` : project.locality}
            </span>
          </p>
          {price ? (
            <p className="text-small font-bold text-on-dark-accent tabular-nums">{price}</p>
          ) : null}
        </div>
      </NextLink>
    </li>
  );
}

function DeveloperSpotlight({
  developer,
  headingId,
  eyebrowId,
  className,
}: DeveloperSpotlightProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const figures = [
    developer.years ? { label: "domain.developerSpotlight.years", value: developer.years } : null,
    developer.delivered
      ? { label: "domain.developerSpotlight.delivered", value: developer.delivered }
      : null,
    developer.listed > 0
      ? { label: "domain.developerSpotlight.listed", value: developer.listed }
      : null,
    developer.launching > 0
      ? { label: "domain.developerSpotlight.launching", value: developer.launching }
      : null,
  ].flatMap((figure) => (figure ? [figure] : []));
  const number = new Intl.NumberFormat(locale);
  const projects = developer.projects.slice(0, PROJECTS_SHOWN);

  return (
    <div
      data-slot="developer-spotlight"
      className={cn(
        "relative isolate grid gap-6 overflow-hidden rounded-xl bg-dark p-5 text-on-dark md:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:gap-8",
        className,
      )}
    >
      <div aria-hidden="true" className="spotlight-glow" />
      <div className="flex min-w-0 flex-col gap-3">
        <p id={eyebrowId} className="text-overline text-on-dark-muted">
          {translate("domain.developerSpotlight.sponsored")}
          <span aria-hidden="true"> ·</span> {translate("domain.developerSpotlight.label")}
        </p>
        <div className="flex min-w-0 items-center gap-3 lg:flex-col lg:items-start">
          {developer.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- an uploaded logo of any shape, shown whole and small
            <img
              src={developer.logo}
              alt=""
              className="size-12 shrink-0 rounded-lg bg-surface object-contain p-1"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-lg bg-dark-active text-title-sm font-bold text-on-dark-accent"
            >
              {initialsOf(developer.name)}
            </span>
          )}
          <h2 id={headingId} className="min-w-0 text-h2 break-words text-on-dark">
            {developer.name}
          </h2>
        </div>
        {developer.about ? (
          <p className="text-small text-on-dark-muted">{developer.about}</p>
        ) : null}
        {figures.length > 0 ? (
          <dl className="flex flex-wrap gap-x-5 gap-y-3">
            {figures.map((figure) => (
              <div key={figure.label} className="flex flex-col-reverse">
                <dt className="text-overline text-on-dark-muted">{translate(figure.label)}</dt>
                <dd className="text-h3 text-on-dark tabular-nums">{number.format(figure.value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {developer.website ? (
          // eslint-disable-next-line react/jsx-no-target-blank -- rel is set to sponsored noopener (R-FE-14, R-FE-15)
          <a
            href={developer.website}
            target="_blank"
            rel="sponsored noopener"
            className="inline-flex h-(--size-btn-sm) items-center gap-2 self-start rounded-sm border border-dark-line px-4 text-small font-semibold text-on-dark transition-colors duration-(--dur-fast) hover:border-on-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark"
          >
            {translate("domain.developerSpotlight.website")}{" "}
            <span className="sr-only">{translate("common.opensInNewTab")}</span>
            <Icon icon={ArrowUpRight} size="sm" />
          </a>
        ) : null}
      </div>
      {projects.length > 0 ? (
        <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {projects.map((project) => (
            <ProjectCard
              key={project.href}
              project={project}
              translate={translate}
              locale={locale}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export {
  DeveloperSpotlight,
  type DeveloperSpotlightData,
  type DeveloperSpotlightProject,
  type DeveloperSpotlightProps,
};
