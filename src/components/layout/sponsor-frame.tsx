"use client";

/**
 * SponsorFrame: shows the chosen sponsored banners in the platform's frame, with a pager when
 *   there is more than one. Use SponsorSlot, which picks the banners; this is its client part.
 * Purpose: the platform owns the frame, the "Sponsored" label, "About this ad" and the pager; the
 *   advertiser owns only the picture. Owner: design system.
 * Props: sponsors and format (from selectSponsors, src/lib/sponsors.ts), defaultInfoOpen (shows
 *   "About this ad" open, for the Design Lab), className. The first picture loads at once
 *   (it is above the fold); the others load when shown.
 * Responsive: the strip is 970 x 90 from 1024 px and a 16:5 compact banner below; the panel is a
 *   540 x 510 frame from 1024 px and a 2:1 banner below. Frames use a fixed aspect ratio, so the
 *   page does not jump when a picture loads.
 * Accessibility: the link's name is the picture's alt text plus "(opens in a new tab)"; links carry
 *   rel="sponsored noopener". The pager is two buttons and a count, with no autoplay; the current
 *   banner is announced politely. "About this ad" is a button that opens a popover.
 * States: one banner, several banners, contain (shown whole on a neutral ground), info open, a
 *   picture that fails to load is removed, and if all fail the whole slot disappears.
 * Dependencies: next/image getImageProps, Popover, IconButton, Link, next-intl.
 * Tests: sponsor.test.tsx; Design Lab "Ads" (S2-T07).
 * UX reference: ds-ads, sponsored banner container (c-cards.css .sp).
 */
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { getImageProps } from "next/image";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/patterns/popover";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import type { SelectedSponsor, SponsorFormat } from "@/lib/sponsors";

type SponsorFrameProps = {
  sponsors: SelectedSponsor[];
  format: SponsorFormat;
  defaultInfoOpen?: boolean;
  className?: string;
};

const SIZES = {
  strip: "(min-width: 1024px) 970px, 100vw",
  panel: "(min-width: 1024px) 524px, 100vw",
} as const;

const FORMAT_STYLES = {
  strip:
    "mx-auto max-w-140 lg:max-w-242.5 [&_a]:aspect-16/5 [&_a]:rounded-lg lg:[&_a]:aspect-[970/90] lg:[&_a]:rounded-md",
  panel:
    "[&_a]:aspect-2/1 [&_a]:rounded-lg lg:[&_a]:aspect-[540/510] lg:[&_a]:rounded-xl lg:[&_a]:p-2 lg:[&_a]:shadow-hover",
} as const satisfies Record<SponsorFormat, string>;

function SponsorFrame({ sponsors, format, defaultInfoOpen = false, className }: SponsorFrameProps) {
  const translate = useTranslations("sponsor");
  const [failed, setFailed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const visible = sponsors.filter((sponsor) => !failed.includes(sponsor.id));
  if (visible.length === 0) return null;

  const total = visible.length;
  const current = visible[Math.min(index, total - 1)] as SelectedSponsor;
  const position = Math.min(index, total - 1) + 1;
  const unoptimized =
    current.creatives.desktop.unoptimized || current.creatives.compact.unoptimized;
  const desktop = getImageProps({
    alt: current.alt,
    src: current.creatives.desktop.src,
    width: current.creatives.desktop.width,
    height: current.creatives.desktop.height,
    sizes: SIZES[format],
    priority: position === 1,
    unoptimized: Boolean(unoptimized),
  }).props;
  const compact = getImageProps({
    alt: current.alt,
    src: current.creatives.compact.src,
    width: current.creatives.compact.width,
    height: current.creatives.compact.height,
    sizes: "100vw",
    unoptimized: Boolean(unoptimized),
  }).props;

  return (
    <div
      data-slot="sponsor-slot"
      data-format={format}
      className={cn("relative text-left", className)}
    >
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
        <span className="text-overline text-muted">{translate("label")}</span>
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-muted">
          <Popover defaultOpen={defaultInfoOpen}>
            <PopoverTrigger className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-caption font-semibold text-muted transition-colors duration-(--dur-fast) hover:bg-canvas-sunken hover:text-ink">
              <Icon icon={Info} size="sm" />
              {translate("about")}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-75">
              <p className="font-bold">{translate("aboutTitle")}</p>
              <p className="mt-1 text-muted">{translate("aboutBody")}</p>
            </PopoverContent>
          </Popover>
          {total > 1 ? (
            <span className="inline-flex items-center gap-1">
              <IconButton
                aria-label={translate("previous")}
                className="size-9"
                onClick={() => setIndex((position - 2 + total) % total)}
              >
                <Icon icon={ChevronLeft} />
              </IconButton>
              <span className="min-w-8.5 text-center font-bold text-ink tabular-nums">
                {position} / {total}
              </span>
              <IconButton
                aria-label={translate("next")}
                className="size-9"
                onClick={() => setIndex(position % total)}
              >
                <Icon icon={ChevronRight} />
              </IconButton>
            </span>
          ) : null}
        </span>
      </div>
      <div className={FORMAT_STYLES[format]}>
        {/* eslint-disable-next-line react/jsx-no-target-blank -- rel is set below to sponsored noopener (R-FE-14, R-FE-15) */}
        <a
          href={current.href}
          target="_blank"
          rel="sponsored noopener"
          aria-label={`${current.alt} ${translate("newTab")}`}
          className={cn(
            "relative block overflow-hidden border border-line-strong bg-surface transition-colors duration-(--dur-fast) hover:border-primary",
            current.fit === "contain" && "bg-canvas-sunken",
          )}
        >
          <picture>
            <source media="(min-width: 1024px)" srcSet={desktop.srcSet ?? desktop.src} />
            <img
              {...compact}
              alt=""
              onError={() => setFailed((list) => [...list, current.id])}
              className={cn(
                "block size-full object-center",
                current.fit === "contain" ? "object-contain" : "object-cover",
              )}
            />
          </picture>
        </a>
      </div>
      <p aria-live="polite" className="sr-only">
        {total > 1 ? translate("position", { current: position, total }) : ""}
      </p>
    </div>
  );
}

export { SponsorFrame };
