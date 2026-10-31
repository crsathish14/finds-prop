"use client";

/**
 * SponsorFrame: shows the chosen sponsored banners in the platform's frame, as a carousel when
 *   there is more than one. Use SponsorSlot, which picks the banners; this is its client part.
 * Purpose: the platform owns the frame, the "Sponsored" label, "About this ad" and the pager; the
 *   advertiser owns only the picture. Several banners slide sideways on their own every 5 seconds
 *   (Embla carousel), and the previous and next buttons or a swipe move them by hand. Only the
 *   banner picture moves: the frame (border, corners, shadow), the label row and the pager stay
 *   where they are. Owner: design system.
 * Props: sponsors and format (from selectSponsors, src/lib/sponsors.ts), defaultInfoOpen (shows
 *   "About this ad" open, for the Design Lab), className. The first picture loads at once (it is
 *   above the fold); the others load straight after at low priority, so a banner is never empty
 *   when it slides in.
 * Responsive: the strip is 970 x 90 from 1024 px and a 16:5 compact banner below; the panel is a
 *   540 x 510 frame from 1024 px and a 2:1 banner below. Every slide has the same fixed aspect
 *   ratio, so the page does not jump when a picture loads or the slides move.
 * Accessibility: the area is a carousel region; each slide is a group named "Banner 2 of 3". Only
 *   the banner on show can be reached by Tab or a screen reader. A link's name is the picture's alt
 *   text plus "(opens in a new tab)"; links carry rel="sponsored noopener". Rotation pauses while
 *   the pointer is over the banner and while anything inside it has keyboard focus, and never
 *   starts for people who prefer reduced motion. The new position is announced only when the reader
 *   moves it by hand, never on every automatic turn. "About this ad" opens a popover.
 * States: one banner (still, no pager), several banners (rotating, or still), contain (shown whole
 *   on a neutral ground), info open, a picture that fails to load is removed, and if all fail the
 *   whole slot disappears.
 * Dependencies: embla-carousel-react and its autoplay plugin, next/image getImageProps, Popover,
 *   IconButton, next-intl.
 * Tests: sponsor.test.tsx; Design Lab "Sponsor slot" (S2-T07).
 * UX reference: ds-ads, sponsored banner container (c-cards.css .sp). The rotation is an owner
 *   change to the approved UX (ADR-038).
 */
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { getImageProps } from "next/image";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/patterns/popover";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { SPONSOR_ROTATION_MS, type SelectedSponsor, type SponsorFormat } from "@/lib/sponsors";

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

// The width of the area, and the shape of the frame that stays put while the banners slide in it.
const AREA_STYLES = {
  strip: "mx-auto max-w-140 lg:max-w-242.5",
  panel: "",
} as const satisfies Record<SponsorFormat, string>;

const FRAME_STYLES = {
  strip: "aspect-16/5 rounded-lg lg:aspect-[970/90] lg:rounded-md",
  panel: "aspect-2/1 rounded-lg lg:aspect-[540/510] lg:rounded-xl lg:p-2 lg:shadow-hover",
} as const satisfies Record<SponsorFormat, string>;

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

type SlideProps = {
  sponsor: SelectedSponsor;
  format: SponsorFormat;
  first: boolean;
  active: boolean;
  label: string;
  roleDescription: string;
  newTab: string;
  onFailed: (id: string) => void;
};

function Slide({
  sponsor,
  format,
  first,
  active,
  label,
  roleDescription,
  newTab,
  onFailed,
}: SlideProps) {
  const unoptimized =
    sponsor.creatives.desktop.unoptimized || sponsor.creatives.compact.unoptimized;
  const desktop = getImageProps({
    alt: sponsor.alt,
    src: sponsor.creatives.desktop.src,
    width: sponsor.creatives.desktop.width,
    height: sponsor.creatives.desktop.height,
    sizes: SIZES[format],
    priority: first,
    unoptimized: Boolean(unoptimized),
  }).props;
  const compact = getImageProps({
    alt: sponsor.alt,
    src: sponsor.creatives.compact.src,
    width: sponsor.creatives.compact.width,
    height: sponsor.creatives.compact.height,
    sizes: "100vw",
    // The picture on show first is above the fold and loads at once. The others load too, but at low
    // priority: a lazy picture clipped beside the frame would not load until it slid in, and the
    // reader would see an empty frame.
    ...(first ? { priority: true } : { loading: "eager" as const, fetchPriority: "low" as const }),
    unoptimized: Boolean(unoptimized),
  }).props;

  return (
    <div
      role="group"
      aria-roledescription={roleDescription}
      aria-label={label}
      // A slide that is not on show cannot be reached by Tab or a screen reader.
      aria-hidden={active ? undefined : true}
      inert={!active}
      className="h-full min-w-0 flex-[0_0_100%]"
    >
      {/* eslint-disable-next-line react/jsx-no-target-blank -- rel is set below to sponsored noopener (R-FE-14, R-FE-15) */}
      <a
        href={sponsor.href}
        target="_blank"
        rel="sponsored noopener"
        aria-label={`${sponsor.alt} ${newTab}`}
        // The focus ring is drawn around the fixed frame (it would be clipped here), see FRAME below.
        className={cn(
          "block size-full outline-none",
          sponsor.fit === "contain" ? "bg-canvas-sunken" : "bg-surface",
        )}
      >
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktop.srcSet ?? desktop.src} />
          <img
            {...compact}
            alt=""
            onError={() => onFailed(sponsor.id)}
            className={cn(
              "block size-full object-center",
              sponsor.fit === "contain" ? "object-contain" : "object-cover",
            )}
          />
        </picture>
      </a>
    </div>
  );
}

function SponsorFrame({ sponsors, format, defaultInfoOpen = false, className }: SponsorFrameProps) {
  const translate = useTranslations("sponsor");
  const [failed, setFailed] = useState<string[]>([]);
  const visible = sponsors.filter((sponsor) => !failed.includes(sponsor.id));
  const total = visible.length;
  const several = total > 1;
  const reducedMotion = usePrefersReducedMotion();

  // The rotation: every 5 seconds; it waits while the pointer is over the banner or focus is
  // inside it, and is not started at all when the reader prefers less motion.
  const plugins = useMemo(
    () =>
      several && !reducedMotion
        ? [
            // Pausing is done below for the whole banner area, buttons included.
            Autoplay({
              delay: SPONSOR_ROTATION_MS,
              stopOnMouseEnter: false,
              stopOnFocusIn: false,
              stopOnInteraction: false,
            }),
          ]
        : [],
    [several, reducedMotion],
  );
  const [viewport, carousel] = useEmblaCarousel(
    { loop: several, watchDrag: several, duration: reducedMotion ? 0 : 25 },
    plugins,
  );

  // Wait while the pointer is over the banner area or focus is inside it; go on when both leave.
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const autoplay = carousel?.plugins().autoplay;
  const waiting = pointerInside || focusInside;
  useEffect(() => {
    if (!autoplay) return;
    if (waiting) autoplay.stop();
    else autoplay.play();
  }, [autoplay, waiting]);

  const [selected, setSelected] = useState(0);
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    if (!carousel) return;
    const update = () => setSelected(carousel.selectedScrollSnap());
    update();
    carousel.on("select", update).on("reInit", update);
    return () => {
      carousel.off("select", update).off("reInit", update);
    };
  }, [carousel]);

  // Start again from a clean state when a picture is removed.
  useEffect(() => {
    carousel?.reInit();
  }, [carousel, total]);

  const move = useCallback(
    (direction: "previous" | "next") => {
      setAnnounce(true);
      if (direction === "previous") carousel?.scrollPrev();
      else carousel?.scrollNext();
    },
    [carousel],
  );

  if (total === 0) return null;
  const position = Math.min(selected, total - 1) + 1;
  const first = visible[0] as SelectedSponsor;

  return (
    <div
      data-slot="sponsor-slot"
      data-format={format}
      role="region"
      aria-roledescription={translate("carouselKind")}
      aria-label={translate("carousel")}
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
                onClick={() => move("previous")}
              >
                <Icon icon={ChevronLeft} />
              </IconButton>
              <span className="min-w-8.5 text-center font-bold text-ink tabular-nums">
                {position} / {total}
              </span>
              <IconButton
                aria-label={translate("next")}
                className="size-9"
                onClick={() => move("next")}
              >
                <Icon icon={ChevronRight} />
              </IconButton>
            </span>
          ) : null}
        </span>
      </div>
      {/* FRAME: the border, corners, padding and shadow never move; only the banners slide inside it. */}
      <div className={AREA_STYLES[format]}>
        <div
          className={cn(
            "relative border border-line-strong bg-surface transition-colors duration-(--dur-fast) hover:border-primary",
            "has-[a:focus-visible]:outline-(length:--focus-w) has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus",
            FRAME_STYLES[format],
          )}
        >
          <div ref={viewport} className="size-full overflow-hidden rounded-[inherit]">
            <div className="flex size-full">
              {visible.map((sponsor, index) => (
                <Slide
                  key={sponsor.id}
                  sponsor={sponsor}
                  format={format}
                  first={sponsor.id === first.id}
                  active={index === Math.min(selected, total - 1)}
                  label={translate("position", { current: index + 1, total })}
                  roleDescription={translate("slideKind")}
                  newTab={translate("newTab")}
                  onFailed={(id) => setFailed((list) => [...list, id])}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {several && announce ? translate("position", { current: position, total }) : ""}
      </p>
    </div>
  );
}

export { SponsorFrame };
