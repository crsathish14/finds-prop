/**
 * SponsorCinematicBanner: one sponsor as a tall photo with words laid on it, the Cinematic style of the hero ad
 * (concept B).
 * Purpose: shows the sponsor's photo full width with a shade, the brand, an eyebrow, the headline, one line and the
 *   button the admin typed, and a small "Up next" box naming the following sponsor (ADR-187). Owner: design system.
 *   It holds no state; <SponsorStyledFrame> rotates several and owns the Sponsored label.
 * Props: ad (a SponsorAd that is ready for the Cinematic style: photo, brand and cinematic words), next ({ brand,
 *   photo } of the following sponsor, or nothing), words ({ upNext, newTab }, already translated), priority (the
 *   first ad: its photo loads at once), drift (the slow photo movement), drawLine (the gold line drawn once around
 *   the frame), className.
 * Responsive: 300 px tall from 768 px with the words on the left over a side shade; below that 400 px tall with the
 *   words at the bottom over a rising shade, a full-width button and no "Up next" box.
 * Accessibility: the headline is a heading; the photo is decoration; the whole banner has one link (the button),
 *   named by its words, with the new-tab notice and rel="sponsored noopener" when it leaves the site. The words sit on
 *   a dark shade, so they keep their contrast whatever the photo. The gold line is aria-hidden.
 * States: with and without eyebrow and line, with and without "Up next", one of our projects or another site, a long
 *   headline, the photo failing (the dark ground shows).
 * Dependencies: next/image, NextLink, Icon, cn. Tests: sponsor-styled.test.tsx; Design Lab "Ads" (Cinematic banner).
 * UX reference: none in the approved UX; the owner's sponsor concepts of 23 Nov 2026 (concept B).
 */
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { SponsorAd, SponsorCinematic, SponsorImage } from "@/lib/sponsors";

type SponsorCinematicWords = {
  upNext: string;
  newTab: string;
};

type CinematicAd = Pick<SponsorAd, "href" | "external" | "alt"> & {
  brand: string;
  photo: SponsorImage;
  cinematic: SponsorCinematic;
};

type SponsorCinematicBannerProps = {
  ad: CinematicAd;
  next?: { brand: string; photo: SponsorImage } | undefined;
  words: SponsorCinematicWords;
  priority?: boolean;
  drift?: boolean;
  drawLine?: boolean;
  className?: string;
};

const BUTTON =
  "inline-flex h-(--size-btn-sm) items-center justify-center gap-2 self-stretch rounded-sm bg-surface px-5 text-small font-semibold text-ink transition-colors duration-(--dur-fast) hover:bg-primary-tint md:self-start";

function SponsorCinematicBanner({
  ad,
  next,
  words,
  priority = false,
  drift = true,
  drawLine = true,
  className,
}: SponsorCinematicBannerProps) {
  const { cinematic } = ad;
  const label = (
    <>
      {cinematic.button}
      <Icon icon={ArrowRight} size="sm" />
    </>
  );
  return (
    <article
      data-slot="sponsor-cinematic-banner"
      className={cn(
        "relative isolate h-100 overflow-hidden rounded-xl bg-dark text-on-dark md:h-75",
        className,
      )}
    >
      <Image
        src={ad.photo.src}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 970px, 100vw"
        unoptimized={Boolean(ad.photo.unoptimized)}
        className={cn("-z-10 object-cover", drift && "sp-drift")}
      />
      {/* The shade keeps the words readable on any photo: rising from the bottom on a phone, from the left above. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-dark/95 via-dark/60 to-transparent md:bg-linear-to-r md:from-dark/90 md:via-dark/55 md:to-transparent"
      />
      {drawLine ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="sp-gold pointer-events-none absolute inset-0 size-full"
        >
          <rect
            x="0.5"
            y="0.5"
            width="99"
            height="99"
            rx="3"
            pathLength={100}
            vectorEffect="non-scaling-stroke"
            className="fill-none stroke-amber stroke-[1.5]"
          />
        </svg>
      ) : null}
      <span className="absolute top-3 right-3 inline-flex max-w-[60%] items-center rounded-pill bg-on-dark/15 px-3 py-1 text-caption font-semibold backdrop-blur-sm">
        <span className="truncate">{ad.brand}</span>
      </span>
      <div className="absolute inset-x-4 bottom-6 flex flex-col gap-2 md:inset-x-auto md:bottom-8 md:left-9 md:max-w-108 md:gap-3">
        {cinematic.eyebrow ? <p className="text-overline text-amber">{cinematic.eyebrow}</p> : null}
        <h3 className="text-h2 text-on-dark">{cinematic.headline}</h3>
        {cinematic.line ? <p className="text-small text-on-dark-muted">{cinematic.line}</p> : null}
        {ad.external === false ? (
          <NextLink href={ad.href} className={BUTTON}>
            {label}
          </NextLink>
        ) : (
          // eslint-disable-next-line react/jsx-no-target-blank -- rel is set to sponsored noopener (R-FE-14, R-FE-15)
          <a href={ad.href} target="_blank" rel="sponsored noopener" className={BUTTON}>
            {label} <span className="sr-only">{words.newTab}</span>
          </a>
        )}
      </div>
      {next ? (
        <div className="absolute right-4 bottom-4 hidden items-center gap-3 rounded-lg bg-dark/60 py-2 pr-3 pl-2 text-caption backdrop-blur-sm md:flex">
          <span className="relative block h-9 w-12 overflow-hidden rounded-md bg-dark">
            <Image
              src={next.photo.src}
              alt=""
              fill
              sizes="48px"
              unoptimized={Boolean(next.photo.unoptimized)}
              className="object-cover"
            />
          </span>
          <span className="flex flex-col">
            <span className="text-overline text-on-dark-muted">{words.upNext}</span>
            <span className="max-w-40 truncate font-semibold">{next.brand}</span>
          </span>
        </div>
      ) : null}
    </article>
  );
}

export { SponsorCinematicBanner };
export type { CinematicAd, SponsorCinematicBannerProps, SponsorCinematicWords };
