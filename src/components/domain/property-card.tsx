/**
 * PropertyCard: one home in a grid or a list of results.
 * Purpose: the card for search results, the homepage and saved homes. Owner: design system. It holds
 *   no state and fetches nothing: the page passes the home's facts, and the heart and Compare
 *   controls as slots (SaveButton and CompareToggle from property-card-controls.client.tsx).
 * Props: property (href, title, locality, city, rupees, listingType, bedrooms, bathrooms, areaSqft,
 *   label "featured" | "prime" | "budget", listedAgo, typeLabel, distanceText ("2.4 km away", after the
 *   place, only when a place was searched), summary, cover { src, alt }), layout ("grid"
 *   default | "list" | "compact" | "mini"), compared (draws the chosen ring), save and compare (the control slots),
 *   sizes (next/image `sizes` for this card's column), priority (first cards on the page), className.
 *   listedAgo, typeLabel ("Apartment", shown at the right of the foot) and summary are already-
 *   translated text from the page. Missing facts are left out,
 *   never shown blank or as zero.
 * Responsive: a column of picture over text. The list layout puts the picture beside the text when
 *   the card's own box is wide enough (a container query, not the screen width) and stacks below that.
 *   The compact layout (the AI chat's cards page, ADR-220) is always one row about 5.5 rem tall: a
 *   5 rem square picture, the price, title, "3 BHK · 1,450 sq ft" and the locality, one badge
 *   (Featured or Prime, else For sale or For rent), the heart at the top right and Compare at the
 *   bottom right, both keeping their 44 px tap size. It leaves out listedAgo, typeLabel, baths, the city and the summary.
 *   The mini layout (the AI chat's cards page on a phone or tablet, two to a row) is a small card: a 3:2
 *   picture with the badge (Featured or Prime, else For sale or For rent) and the heart, then the price, the
 *   title on one line, "3 BHK · 1,450 sq ft" and the locality, and Compare in a foot row. It leaves out the same
 *   facts as the compact layout.
 * Accessibility: the whole card is one link target: the title link is stretched over the card, while
 *   the heart and Compare stay separate focusable controls above it. A keyboard ring is drawn
 *   around the card when the title link has focus. The picture has the home's alt text.
 * States: default, hover (lift and zoom), focus, chosen for compare (ring), list, compact, loading
 *   (PropertyCardSkeleton, also compact), picture missing or failed (illustrated tile).
 * Dependencies: Badge, PriceDisplay, Icon, Skeleton, format helpers, next-intl.
 * Tests: property-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: search screen, results grid and list view (c-cards.css .pcard, .pcard--list).
 */
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceDisplay } from "@/components/patterns/price-display";
import { cn } from "@/lib/cn";
import { formatArea, type Translate } from "@/lib/format";
import { CardCover } from "./property-card-controls.client";

type PropertyCardData = {
  href: string;
  title: string;
  locality: string;
  city: string;
  rupees: number;
  listingType: "sale" | "rent";
  bedrooms?: number | null | undefined;
  bathrooms?: number | null | undefined;
  areaSqft?: number | null | undefined;
  label?: "featured" | "prime" | "budget" | null | undefined;
  /** "3 days ago", already translated by the page. */
  listedAgo?: string | undefined;
  /** The kind of property, "Apartment", already translated by the page. */
  typeLabel?: string | undefined;
  /** "2.4 km away", already translated by the page; only when a place was searched. */
  distanceText?: string | undefined;
  /** One or two sentences shown in the list layout only, already translated by the page. */
  summary?: string | undefined;
  cover?: { src: string; alt: string } | null | undefined;
};

type PropertyCardLayout = "grid" | "list" | "compact" | "mini";

type PropertyCardProps = {
  property: PropertyCardData;
  layout?: PropertyCardLayout;
  compared?: boolean;
  save?: ReactNode;
  compare?: ReactNode;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

const LABEL_KEYS = {
  featured: "domain.propertyCard.label.featured",
  prime: "domain.propertyCard.label.prime",
} as const;

const DEFAULT_SIZES = "(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw";
/** The compact card's picture is a fixed 5 rem square (80 px), whatever the screen. */
const COMPACT_SIZES = "80px";
/** The mini card is half the screen wide on a phone, and at most a column of the cards page on a tablet. */
const MINI_SIZES = "(min-width: 768px) 25vw, 50vw";

/** The ring a card draws when it is chosen for compare through the toggle inside it. */
const COMPARED_RING =
  "has-[button[data-compare][aria-pressed=true]]:border-primary has-[button[data-compare][aria-pressed=true]]:outline-1 has-[button[data-compare][aria-pressed=true]]:outline-primary";

function PropertyCard({
  property,
  layout = "grid",
  compared = false,
  save,
  compare,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
}: PropertyCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const list = layout === "list";
  const { bedrooms, bathrooms, areaSqft } = property;

  if (layout === "mini") {
    const label =
      property.label === "featured" || property.label === "prime" ? property.label : null;
    return (
      <div className={cn("@container h-full", className)}>
        <article
          data-slot="property-card"
          data-layout="mini"
          className={cn(
            "group/card relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface",
            "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
            "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
            compared ? "border-primary outline-1 outline-primary" : "border-line",
            COMPARED_RING,
          )}
        >
          <div className="relative aspect-3/2 shrink-0 overflow-hidden bg-canvas-sunken">
            <CardCover
              src={property.cover?.src}
              alt={property.cover?.alt}
              sizes={MINI_SIZES}
              priority={priority}
            />
            <div className="pointer-events-none absolute bottom-1 left-1 z-10">
              {label ? (
                <Badge tone={label} className="h-5 px-2">
                  {translate(LABEL_KEYS[label])}
                </Badge>
              ) : (
                <Badge tone="outline" className="h-5 px-2">
                  {translate(
                    property.listingType === "sale"
                      ? "domain.propertyCard.forSale"
                      : "domain.propertyCard.forRent",
                  )}
                </Badge>
              )}
            </div>
            {save}
          </div>
          <div className="flex min-w-0 flex-1 flex-col px-2 pt-2">
            <PriceDisplay
              rupees={property.rupees}
              listingType={property.listingType}
              className="truncate"
            />
            <h3 className="text-small font-bold text-ink" data-slot="property-card-title">
              <Link
                href={property.href}
                data-stretched=""
                className="block min-h-6 truncate rounded-xs font-bold leading-6 text-ink no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
              >
                {property.title}
              </Link>
            </h3>
            {bedrooms || areaSqft ? (
              <ul className="flex gap-x-1 overflow-hidden text-caption font-semibold whitespace-nowrap text-ink [&>li+li]:before:mr-1 [&>li+li]:before:text-muted [&>li+li]:before:content-['·']">
                {bedrooms ? <li>{translate("property.bhk", { count: bedrooms })}</li> : null}
                {areaSqft ? <li>{formatArea(translate, locale, areaSqft)}</li> : null}
              </ul>
            ) : null}
            <p className="flex items-center gap-1 text-caption text-muted">
              <Icon icon={MapPin} size="sm" className="shrink-0 text-primary" />
              <span className="truncate">{property.locality}</span>
            </p>
          </div>
          {compare ? <div className="relative z-20 px-2">{compare}</div> : <div className="pb-2" />}
        </article>
      </div>
    );
  }

  if (layout === "compact") {
    const label =
      property.label === "featured" || property.label === "prime" ? property.label : null;
    return (
      <div className={cn("@container h-full", className)}>
        <article
          data-slot="property-card"
          data-layout="compact"
          className={cn(
            "group/card relative flex h-full min-h-22 gap-3 overflow-hidden rounded-xl border bg-surface p-1",
            "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
            "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
            compared ? "border-primary outline-1 outline-primary" : "border-line",
            COMPARED_RING,
          )}
        >
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas-sunken">
            <CardCover
              src={property.cover?.src}
              alt={property.cover?.alt}
              sizes={COMPACT_SIZES}
              priority={priority}
            />
            <div className="pointer-events-none absolute bottom-1 left-1 z-10">
              {label ? (
                <Badge tone={label} className="h-5 px-2">
                  {translate(LABEL_KEYS[label])}
                </Badge>
              ) : (
                <Badge tone="outline" className="h-5 px-2">
                  {translate(
                    property.listingType === "sale"
                      ? "domain.propertyCard.forSale"
                      : "domain.propertyCard.forRent",
                  )}
                </Badge>
              )}
            </div>
          </div>
          {/* The heart sits flush at the top right, so it and Compare (bottom right) are two 44 px targets that do not overlap. */}
          <div className="[&>button]:top-0 [&>button]:right-0">{save}</div>
          <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
            <PriceDisplay
              rupees={property.rupees}
              listingType={property.listingType}
              className="truncate pr-10"
            />
            <h3 className="pr-10 text-small font-bold text-ink" data-slot="property-card-title">
              <Link
                href={property.href}
                data-stretched=""
                className="block min-h-6 truncate rounded-xs font-bold leading-6 text-ink no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
              >
                {property.title}
              </Link>
            </h3>
            {/* The last two lines end before Compare, which sits over the card's bottom right corner. */}
            <div className={cn("min-w-0", compare && "pr-24")}>
              {bedrooms || areaSqft ? (
                <ul className="flex gap-x-1 overflow-hidden text-caption font-semibold whitespace-nowrap text-ink [&>li+li]:before:mr-1 [&>li+li]:before:text-muted [&>li+li]:before:content-['·']">
                  {bedrooms ? <li>{translate("property.bhk", { count: bedrooms })}</li> : null}
                  {areaSqft ? <li>{formatArea(translate, locale, areaSqft)}</li> : null}
                </ul>
              ) : null}
              <p className="flex items-center gap-1 text-caption text-muted">
                <Icon icon={MapPin} size="sm" className="shrink-0 text-primary" />
                <span className="truncate">{property.locality}</span>
              </p>
            </div>
          </div>
          {compare ? <div className="absolute right-1 bottom-0 z-20">{compare}</div> : null}
        </article>
      </div>
    );
  }

  return (
    <div className={cn("@container h-full", className)}>
      <article
        data-slot="property-card"
        data-layout={layout}
        className={cn(
          "group/card relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface",
          "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
          "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
          // Chosen for compare: from the prop (the Design Lab) or from the toggle inside the card.
          compared ? "border-primary outline-1 outline-primary" : "border-line",
          COMPARED_RING,
          list && "@xl:flex-row",
        )}
      >
        <div
          className={cn(
            "relative aspect-4/3 shrink-0 overflow-hidden bg-canvas-sunken",
            list && "@xl:aspect-auto @xl:min-h-52 @xl:w-2/5",
          )}
        >
          <CardCover
            src={property.cover?.src}
            alt={property.cover?.alt}
            sizes={sizes}
            priority={priority}
          />
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            <Badge tone="outline">
              {translate(
                property.listingType === "sale"
                  ? "domain.propertyCard.forSale"
                  : "domain.propertyCard.forRent",
              )}
            </Badge>
            {property.label && property.label !== "budget" ? (
              <Badge tone={property.label}>{translate(LABEL_KEYS[property.label])}</Badge>
            ) : null}
          </div>
        </div>
        {save}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* In the list layout the heart sits at the card's right edge, so the text keeps clear of it. */}
          <div
            className={cn("flex flex-1 flex-col gap-2 px-4 pt-4 pb-3", list && "@xl:p-5 @xl:pr-14")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <PriceDisplay rupees={property.rupees} listingType={property.listingType} />
              {property.listedAgo ? (
                <span className="text-caption whitespace-nowrap text-muted">
                  {property.listedAgo}
                </span>
              ) : null}
            </div>
            <h3
              className={cn("text-title-sm text-ink", !list && "line-clamp-2")}
              data-slot="property-card-title"
            >
              <Link
                href={property.href}
                data-stretched=""
                className="rounded-xs font-bold text-ink no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
              >
                {property.title}
              </Link>
            </h3>
            <p className="flex items-center gap-2 text-small text-muted">
              <Icon icon={MapPin} className="shrink-0 text-primary" />
              <span className="truncate">
                {translate("domain.propertyCard.location", {
                  locality: property.locality,
                  city: property.city,
                })}
              </span>
              {property.distanceText ? (
                <span className="shrink-0 font-semibold text-ink">{property.distanceText}</span>
              ) : null}
            </p>
            {bedrooms || bathrooms || areaSqft ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-semibold text-ink">
                {bedrooms ? (
                  <li className="inline-flex items-center gap-2">
                    <Icon icon={BedDouble} className="text-primary" />
                    {translate("property.bhk", { count: bedrooms })}
                  </li>
                ) : null}
                {bathrooms ? (
                  <li className="inline-flex items-center gap-2">
                    <Icon icon={Bath} className="text-primary" />
                    {translate("property.bath", { count: bathrooms })}
                  </li>
                ) : null}
                {areaSqft ? (
                  <li className="inline-flex items-center gap-2">
                    <Icon icon={Ruler} className="text-primary" />
                    {formatArea(translate, locale, areaSqft)}
                  </li>
                ) : null}
              </ul>
            ) : null}
            {list && property.summary ? (
              <p className="line-clamp-2 text-body text-muted">{property.summary}</p>
            ) : null}
          </div>
          {compare || property.typeLabel ? (
            <div
              className={cn(
                "relative z-20 flex items-center justify-between gap-3 border-t border-line py-1 pr-4 pl-4",
                list && "@xl:border-t-0 @xl:px-5 @xl:pb-3",
              )}
            >
              {compare ?? <span />}
              {property.typeLabel ? (
                <span className="text-caption text-muted">{property.typeLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

/** The card while its data loads: the same box, so the page does not jump. */
function PropertyCardSkeleton({
  layout = "grid",
  className,
}: {
  layout?: PropertyCardLayout;
  className?: string;
}) {
  const list = layout === "list";
  if (layout === "mini") {
    // The mini card's box: a 3:2 picture over the price, title and place, and the Compare row.
    return (
      <div className={cn("@container h-full", className)} aria-hidden="true">
        <div
          data-slot="property-card-skeleton"
          data-layout="mini"
          className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface"
        >
          <Skeleton className="aspect-3/2 w-full rounded-none" />
          <div className="flex flex-col gap-2 p-2">
            <Skeleton shape="text" className="w-2/5" />
            <Skeleton shape="text" className="w-4/5" />
            <Skeleton shape="text" className="w-3/5" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
      </div>
    );
  }
  if (layout === "compact") {
    // The compact card's box: a 5 rem picture square, then the price, title and place.
    return (
      <div className={cn("@container h-full", className)} aria-hidden="true">
        <div
          data-slot="property-card-skeleton"
          data-layout="compact"
          className="flex h-full min-h-22 gap-3 overflow-hidden rounded-xl border border-line bg-surface p-1"
        >
          <Skeleton className="size-20 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1 pr-3">
            <Skeleton shape="text" className="w-2/5" />
            <Skeleton shape="text" className="w-4/5" />
            <Skeleton shape="text" className="w-3/5" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("@container h-full", className)} aria-hidden="true">
      <div
        data-slot="property-card-skeleton"
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
          list && "@xl:flex-row",
        )}
      >
        <Skeleton
          className={cn(
            "aspect-4/3 w-full rounded-none",
            list && "@xl:aspect-auto @xl:min-h-52 @xl:w-2/5",
          )}
        />
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton shape="text" className="w-2/5" />
          <Skeleton shape="text" className="w-11/12" />
          <Skeleton shape="text" className="w-3/5" />
          <Skeleton shape="text" className="w-2/5" />
        </div>
      </div>
    </div>
  );
}

export { PropertyCard, PropertyCardSkeleton };
export type { PropertyCardData, PropertyCardLayout };
