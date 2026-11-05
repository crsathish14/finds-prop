"use client";

/**
 * PropertyGallery: the photos of one home (or project), one at a time, with a strip of thumbnails.
 * Purpose: the picture block at the top of the property and project pages. Owner: design system. It
 *   holds only which photo is showing; the page passes the photos, already described, and the badges.
 * Props: photos (each { src, alt, label }: the address, what it shows, and a short name such as
 *   "Kitchen" that names its thumbnail), badges (what is drawn over the top left of the picture, such
 *   as "For sale" and "Featured"; the page supplies it), startIndex (the photo to show first, 0),
 *   bleed (true by default: on a phone the block runs edge to edge; false keeps it inside the page's
 *   padding), sizes (next/image `sizes` of the main picture), priority (load the first photo at once;
 *   set it on the page's main gallery), className.
 * Responsive: from 768 px the picture is 16 : 10 with 24 px corners, with Previous and Next buttons
 *   over it, the count "2 / 6" and a strip of six thumbnails per row under it. Below 768 px the
 *   picture is 4 : 3 and runs edge to edge; the buttons and thumbnails are hidden, the visitor swipes,
 *   and dots under the picture show where they are.
 * Accessibility: a carousel named "Photos" whose pictures are slides ("2 of 6"); only the photo
 *   showing is exposed to a screen reader. The picture area takes focus: the left and right arrow keys
 *   change the photo. Thumbnails are buttons named "Photo 3: Kitchen" ("Photo 3" with no name) and the
 *   current one has aria-current. Previous and Next are real buttons, disabled at the ends. The count
 *   is a polite live region. One photo or none hides the buttons, thumbnails, dots and count. Motion is
 *   instant under prefers-reduced-motion.
 * States: several photos, one photo, no photo (the illustrated tile), a photo that fails to load (the
 *   tile in its place), at the first and the last photo, with and without badges, bleed and not
 *   (PropertyGallerySkeleton while loading).
 * Dependencies: CardCover, IconButton, Icon, Skeleton, next-intl, cn.
 * Tests: property-gallery.test.tsx, keyboard.spec.ts; Design Lab "Domain" (S4-T01).
 * UX reference: property and project screens, gallery (c-cards.css .gallery, fp.js FP.gallery);
 *   interaction-specifications, Gallery. The UX has no full-screen viewer or zoom, so none is built.
 *   The UX draws the arrows enabled; here they are disabled at the ends, as the scrolling row's are.
 */
import { ChevronLeft, ChevronRight, Image as ImageGlyph } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { CardCover } from "./property-card-controls.client";

type GalleryPhoto = {
  src: string;
  /** What the photo shows, from the listing's description of it. */
  alt: string;
  /** A short name for its thumbnail, such as "Kitchen". */
  label?: string | undefined;
};

type PropertyGalleryProps = {
  photos: readonly GalleryPhoto[];
  badges?: ReactNode;
  startIndex?: number;
  bleed?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

const MAIN_SIZES = "(min-width: 1100px) 60vw, (min-width: 768px) 90vw, 100vw";
const THUMB_SIZES = "(min-width: 1100px) 10vw, 15vw";
/** How long a press of Previous, Next or a thumbnail may take to arrive before the scroll position is trusted again. */
const SETTLE_MS = 700;

/** A key that stays the same for the same photo in the same place. */
function photoKey(index: number, photo: GalleryPhoto): string {
  return [index, photo.src].join("-");
}

function clamp(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

function PropertyGallery({
  photos,
  badges,
  startIndex = 0,
  bleed = true,
  sizes = MAIN_SIZES,
  priority = false,
  className,
}: PropertyGalleryProps) {
  const translate = useTranslations("domain.gallery");
  const count = photos.length;
  const many = count > 1;
  const [active, setActive] = useState(() => clamp(startIndex, count));
  const viewport = useRef<HTMLDivElement>(null);
  // The photo a press is scrolling to; scroll events on the way there are not photos the visitor chose.
  const target = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPhoto = useCallback(
    (index: number) => {
      const node = viewport.current;
      const next = clamp(index, count);
      setActive(next);
      if (!node) return;
      target.current = next;
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        target.current = null;
      }, SETTLE_MS);
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollTo({ left: next * node.clientWidth, behavior: calm ? "auto" : "smooth" });
    },
    [count],
  );

  function onScroll() {
    const node = viewport.current;
    if (!node || node.clientWidth === 0) return;
    const shown = clamp(Math.round(node.scrollLeft / node.clientWidth), count);
    if (target.current !== null) {
      if (shown === target.current) target.current = null;
      return;
    }
    setActive(shown);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!many) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPhoto(active - 1);
    }
  }

  // A turned or resized screen changes the width of a slide; keep the same photo in view.
  useEffect(() => {
    function keepInView() {
      const node = viewport.current;
      if (node) node.scrollTo({ left: active * node.clientWidth, behavior: "auto" });
    }
    window.addEventListener("resize", keepInView);
    return () => window.removeEventListener("resize", keepInView);
  }, [active]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const slides = count > 0 ? photos : [null];

  return (
    <div
      data-slot="property-gallery"
      role="group"
      aria-roledescription={translate("carouselKind")}
      aria-label={translate("label")}
      className={cn(className)}
    >
      <div
        className={cn(
          "relative aspect-4/3 overflow-hidden bg-canvas-sunken md:aspect-16/10 md:mx-0 md:rounded-xl",
          bleed ? "-mx-(--gutter) rounded-none" : "aspect-16/10 rounded-xl",
        )}
      >
        <div
          ref={viewport}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          // The area scrolls, so it must take focus for a keyboard user; the arrow keys move the photo.
          tabIndex={0}
          className={cn(
            "flex h-full snap-x snap-mandatory [scrollbar-width:none] focus-visible:-outline-offset-3 [&::-webkit-scrollbar]:hidden",
            many ? "overflow-x-auto" : "overflow-x-hidden",
          )}
        >
          {slides.map((photo, index) => (
            <div
              key={photo ? photoKey(index, photo) : "none"}
              role="group"
              aria-roledescription={translate("slideKind")}
              aria-label={translate("slide", { number: index + 1, total: Math.max(count, 1) })}
              aria-hidden={many && index !== active ? true : undefined}
              className="relative h-full w-full flex-none snap-start"
            >
              <CardCover
                src={photo?.src}
                alt={photo?.alt ?? ""}
                sizes={sizes}
                priority={priority && index === clamp(startIndex, count)}
              />
            </div>
          ))}
        </div>
        {badges ? (
          <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-wrap gap-2">
            {badges}
          </div>
        ) : null}
        {many ? (
          <>
            <IconButton
              aria-label={translate("previous")}
              disabled={active === 0}
              onClick={() => showPhoto(active - 1)}
              className="absolute top-1/2 left-3.5 z-10 hidden -translate-y-1/2 bg-surface/95 shadow-pop hover:bg-surface md:grid"
            >
              <Icon icon={ChevronLeft} size="lg" />
            </IconButton>
            <IconButton
              aria-label={translate("next")}
              disabled={active === count - 1}
              onClick={() => showPhoto(active + 1)}
              className="absolute top-1/2 right-3.5 z-10 hidden -translate-y-1/2 bg-surface/95 shadow-pop hover:bg-surface md:grid"
            >
              <Icon icon={ChevronRight} size="lg" />
            </IconButton>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="absolute right-3.5 bottom-3.5 z-10 inline-flex items-center gap-2 rounded-pill bg-dark/80 px-3 py-2 text-caption font-bold text-on-dark"
            >
              <Icon icon={ImageGlyph} size="sm" />
              {translate("count", { current: active + 1, total: count })}
            </span>
          </>
        ) : null}
      </div>
      {many ? (
        <>
          <div className="mt-3 hidden grid-cols-6 gap-3 md:grid">
            {photos.map((photo, index) => (
              <button
                key={photoKey(index, photo)}
                type="button"
                aria-label={
                  photo.label
                    ? translate("photoLabelled", { number: index + 1, label: photo.label })
                    : translate("photo", { number: index + 1 })
                }
                aria-current={index === active}
                onClick={() => showPhoto(index)}
                className={cn(
                  "relative aspect-4/3 overflow-hidden rounded-md bg-canvas-sunken opacity-80 transition-opacity duration-(--dur-fast) hover:opacity-100",
                  "aria-[current=true]:opacity-100 aria-[current=true]:outline-2 aria-[current=true]:outline-offset-3 aria-[current=true]:outline-primary",
                )}
              >
                <CardCover src={photo.src} alt="" sizes={THUMB_SIZES} />
              </button>
            ))}
          </div>
          <div aria-hidden="true" className="mt-3 flex justify-center gap-2 md:hidden">
            {photos.map((photo, index) => (
              <i
                key={photoKey(index, photo)}
                className={cn(
                  "h-1.75 rounded-pill",
                  index === active ? "w-5 bg-primary" : "w-1.75 bg-line-strong",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The gallery while the page loads: the same box, so nothing moves when the photos arrive. */
function PropertyGallerySkeleton({
  bleed = true,
  className,
}: {
  bleed?: boolean;
  className?: string;
}) {
  return (
    <Skeleton
      data-slot="property-gallery-skeleton"
      className={cn(
        "aspect-4/3 w-full md:mx-0 md:aspect-16/10 md:rounded-xl",
        bleed ? "-mx-(--gutter) w-auto rounded-none" : "aspect-16/10 rounded-xl",
        className,
      )}
    />
  );
}

export { PropertyGallery, PropertyGallerySkeleton };
export type { GalleryPhoto };
