/**
 * SponsorShowcaseCard: one sponsored project as a rich card, the Showcase style of the hero ad (concept A).
 * Purpose: shows the sponsor's photo beside the facts the admin typed (developer, project, locality, homes, size,
 *   possession, price, RERA) with "View project" and, for one of our projects, "Get price list" (ADR-187). Owner:
 *   design system. It holds no state; <SponsorStyledFrame> rotates several and owns the Sponsored label.
 * Props: ad (a SponsorAd that is ready for the Showcase: photo, brand and showcase facts), words ({ viewProject,
 *   priceList, rera, newTab }, already translated), priority (the first ad: its photo loads at once), drift (the slow
 *   photo movement), className.
 * Responsive: the photo sits on top (16:10) and the facts under it on phones; from 768 px the photo takes the left
 *   column and the facts the right. The buttons share the row on a phone.
 * Accessibility: the project name is a heading; the photo is decoration (the facts say it); each link names where it
 *   goes, and one that leaves the site says it opens in a new tab and carries rel="sponsored noopener".
 * States: one of our projects (two buttons), another site (one button, opens a new tab), with and without size,
 *   possession and RERA, a long project name, the photo failing (the neutral ground shows).
 * Dependencies: next/image, NextLink, Icon, cn. Tests: sponsor-styled.test.tsx; Design Lab "Ads" (Showcase card).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (concept A).
 */
import { ArrowRight, BadgeCheck, FileText, MapPin } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { SponsorAd, SponsorImage, SponsorShowcase } from "@/lib/sponsors";

type SponsorShowcaseWords = {
  viewProject: string;
  priceList: string;
  rera: string;
  newTab: string;
};

type ShowcaseAd = Pick<SponsorAd, "href" | "external" | "alt"> & {
  brand: string;
  photo: SponsorImage;
  showcase: SponsorShowcase;
};

type SponsorShowcaseCardProps = {
  ad: ShowcaseAd;
  words: SponsorShowcaseWords;
  priority?: boolean;
  drift?: boolean;
  className?: string;
};

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

/** The enquiry form of one of our project pages (its `#enquiry` anchor). */
function enquiryHref(href: string): string {
  return href + ENQUIRY_ANCHOR;
}

const ENQUIRY_ANCHOR = "#enquiry";

const BUTTON =
  "inline-flex h-(--size-btn-sm) min-w-0 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-small font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:flex-none";

/** A link to the ad's destination: our own page in the same tab, another site in a new tab, marked sponsored. */
function AdLink({
  ad,
  href,
  className,
  newTab,
  children,
}: {
  ad: Pick<SponsorAd, "external">;
  href: string;
  className: string;
  newTab: string;
  children: ReactNode;
}) {
  if (ad.external === false) {
    return (
      <NextLink href={href} className={className}>
        {children}
      </NextLink>
    );
  }
  return (
    // eslint-disable-next-line react/jsx-no-target-blank -- rel is set to sponsored noopener (R-FE-14, R-FE-15)
    <a href={href} target="_blank" rel="sponsored noopener" className={className}>
      {children} <span className="sr-only">{newTab}</span>
    </a>
  );
}

function SponsorShowcaseCard({
  ad,
  words,
  priority = false,
  drift = true,
  className,
}: SponsorShowcaseCardProps) {
  const { showcase } = ad;
  const chips = [showcase.homes, showcase.size, showcase.possession].filter(
    (chip): chip is string => Boolean(chip),
  );
  return (
    <article
      data-slot="sponsor-showcase-card"
      className={cn(
        "grid overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-primary hover:shadow-hover md:grid-cols-[1.15fr_1fr]",
        className,
      )}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-canvas-sunken md:aspect-auto md:min-h-66">
        <Image
          src={ad.photo.src}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 520px, (min-width: 768px) 55vw, 100vw"
          unoptimized={Boolean(ad.photo.unoptimized)}
          className={cn("object-cover", drift && "sp-drift")}
        />
        {showcase.rera ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill bg-surface/95 px-3 py-1 text-caption font-semibold text-ink shadow-card">
            <Icon icon={BadgeCheck} size="sm" className="text-primary" />
            {words.rera}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4 md:p-6">
        <div className="flex min-w-0 items-center gap-2 text-small font-semibold text-ink">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-dark font-display text-caption text-on-dark-accent"
          >
            {initialsOf(ad.brand)}
          </span>
          <span className="truncate">{ad.brand}</span>
        </div>
        <h3 className="text-h3 text-ink">{showcase.project}</h3>
        <p className="flex items-center gap-1 text-small text-muted">
          <Icon icon={MapPin} size="sm" className="shrink-0" />
          <span className="truncate">{showcase.locality}</span>
        </p>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li
                key={chip}
                className="rounded-pill bg-canvas-sunken px-3 py-1 text-caption font-semibold text-ink"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-h3 text-ink tabular-nums">{showcase.price}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <AdLink
            ad={ad}
            href={ad.href}
            newTab={words.newTab}
            className={cn(BUTTON, "bg-primary text-on-primary hover:bg-primary-hover")}
          >
            {words.viewProject}
            <Icon icon={ArrowRight} size="sm" />
          </AdLink>
          {ad.external === false ? (
            <NextLink
              href={enquiryHref(ad.href)}
              className={cn(
                BUTTON,
                "border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
              )}
            >
              <Icon icon={FileText} size="sm" />
              {words.priceList}
            </NextLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { SponsorShowcaseCard };
export type { ShowcaseAd, SponsorShowcaseCardProps, SponsorShowcaseWords };
