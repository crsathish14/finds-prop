"use client";

/**
 * SponsorStyledFrame: the hero's sponsored ads in the style the admin chose, the Showcase card or the Cinematic banner
 * (ADR-187), one at a time, turning by themselves.
 * Purpose: the platform owns the frame: the "Sponsored" label, "About this ad", the progress bars and the previous and
 *   next buttons. The ads are drawn by SponsorShowcaseCard or SponsorCinematicBanner from what the admin typed. Owner:
 *   design system. The page picks the ads (selectStyled in src/lib/sponsors.ts); with none, it shows nothing at all.
 * Props: ads (the ads ready for the style, in the admin's order), style ("showcase" | "cinematic"), defaultInfoOpen
 *   (shows "About this ad" open, for the Design Lab), className.
 * Responsive: see the two ads. All ads sit in one grid cell, so the frame is as tall as the tallest and nothing below
 *   it moves when the ads turn.
 * Accessibility: the area is a carousel region; each ad is a group named "Ad 2 of 3"; only the ad on show can be
 *   reached by Tab or a screen reader (the others are inert). The ads turn when the bar of the ad on show is full
 *   (SPONSOR_ROTATION_MS), wait while the pointer is over the area or focus is inside it, and never turn by themselves
 *   for people who prefer less motion. The new position is announced only when the reader moves it by hand.
 * States: one ad (no bars, no buttons), several (turning, or waiting), each style, info open, reduced motion.
 * Dependencies: SponsorShowcaseCard, SponsorCinematicBanner, Popover, IconButton, next-intl,
 *   src/styles/sponsor-ads.css. Tests: sponsor-styled.test.tsx; Design Lab "Ads" (Styled hero ads).
 * UX reference: the sponsored banner container (ds-ads, .sp) for the label row; the owner's sponsor concepts of
 *   23 Nov 2026 (A and B) for the ads and the progress bars.
 */
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { SponsorCinematicBanner } from "@/components/domain/sponsor-cinematic-banner";
import { SponsorShowcaseCard } from "@/components/domain/sponsor-showcase-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/patterns/popover";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { SPONSOR_ROTATION_MS, type SponsorAd, type SponsorStyle } from "@/lib/sponsors";

type SponsorStyledFrameProps = {
  ads: SponsorAd[];
  style: SponsorStyle;
  defaultInfoOpen?: boolean;
  className?: string;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the reader has asked their device for less motion. False while the page is built. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

function SponsorStyledFrame({
  ads,
  style,
  defaultInfoOpen = false,
  className,
}: SponsorStyledFrameProps) {
  const translate = useTranslations("sponsor");
  const reducedMotion = usePrefersReducedMotion();
  const [current, setCurrent] = useState(0);
  const [announce, setAnnounce] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  const total = ads.length;
  if (total === 0) return null;
  const several = total > 1;
  const shown = Math.min(current, total - 1);
  const paused = pointerInside || focusInside;

  const go = (index: number, byHand: boolean) => {
    setAnnounce(byHand);
    setCurrent(((index % total) + total) % total);
  };

  const showcaseWords = {
    viewProject: translate("viewProject"),
    priceList: translate("priceList"),
    rera: translate("rera"),
    newTab: translate("newTab"),
  };
  const cinematicWords = { upNext: translate("upNext"), newTab: translate("newTab") };

  return (
    <div
      data-slot="sponsor-styled-frame"
      data-style={style}
      data-sponsor-styled=""
      data-sponsor-paused={paused ? "" : undefined}
      role="region"
      aria-roledescription={translate("carouselKind")}
      aria-label={translate("carousel")}
      style={{ "--sp-turn": `${SPONSOR_ROTATION_MS}ms` } as CSSProperties}
      onMouseEnter={() => setPointerInside(true)}
      onMouseLeave={() => setPointerInside(false)}
      onFocus={() => setFocusInside(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusInside(false);
      }}
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
          {several ? (
            <span className="inline-flex items-center gap-1">
              <IconButton
                aria-label={translate("previous")}
                className="size-9"
                onClick={() => go(shown - 1, true)}
              >
                <Icon icon={ChevronLeft} />
              </IconButton>
              <span className="min-w-8.5 text-center font-bold text-ink tabular-nums">
                {shown + 1} / {total}
              </span>
              <IconButton
                aria-label={translate("next")}
                className="size-9"
                onClick={() => go(shown + 1, true)}
              >
                <Icon icon={ChevronRight} />
              </IconButton>
            </span>
          ) : null}
        </span>
      </div>

      {several ? (
        <div aria-hidden="true" className="mb-2 flex gap-1 px-1">
          {ads.map((ad, index) => (
            <span
              key={ad.id}
              className="sp-bar h-0.75 flex-1 overflow-hidden rounded-pill bg-line"
              data-state={index < shown ? "done" : index === shown ? "now" : "waiting"}
            >
              <span
                // A new key starts the bar again whenever this ad comes back on show.
                key={index === shown ? `now-${shown}` : "still"}
                className="sp-bar-fill block h-full bg-primary"
                onAnimationEnd={() => {
                  if (index === shown && !reducedMotion) go(shown + 1, false);
                }}
              />
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid">
        {ads.map((ad, index) => {
          const active = index === shown;
          const following = ads[(index + 1) % total];
          return (
            <div
              key={ad.id}
              role="group"
              aria-roledescription={translate("slideKind")}
              aria-label={translate("adPosition", { current: index + 1, total })}
              aria-hidden={active ? undefined : true}
              inert={!active}
              className={cn(
                "[grid-area:1/1] transition-opacity duration-500 motion-reduce:transition-none",
                active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {style === "showcase" && ad.photo && ad.brand && ad.showcase ? (
                <SponsorShowcaseCard
                  ad={{ ...ad, photo: ad.photo, brand: ad.brand, showcase: ad.showcase }}
                  words={showcaseWords}
                  priority={index === 0}
                  drift={active}
                />
              ) : null}
              {style === "cinematic" && ad.photo && ad.brand && ad.cinematic ? (
                <SponsorCinematicBanner
                  ad={{ ...ad, photo: ad.photo, brand: ad.brand, cinematic: ad.cinematic }}
                  next={
                    several && following?.photo && following.brand
                      ? { brand: following.brand, photo: following.photo }
                      : undefined
                  }
                  words={cinematicWords}
                  priority={index === 0}
                  drift={active}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {several && announce ? translate("adPosition", { current: shown + 1, total }) : ""}
      </p>
    </div>
  );
}

export { SponsorStyledFrame };
export type { SponsorStyledFrameProps };
