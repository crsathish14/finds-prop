/**
 * PropertyCard: one home in a grid or a list of results.
 * Purpose: the card for search results, the homepage and saved homes. Owner: design system. It holds
 *   no state and fetches nothing: the page passes the home's facts, and the heart and Compare
 *   controls as slots (SaveButton and CompareToggle from property-card-controls.client.tsx).
 * Props: property (href, title, locality, city, rupees, listingType, bedrooms, bathrooms, areaSqft,
 *   label "featured" | "prime" | "budget", listedAgo, typeLabel, summary, cover { src, alt }), layout ("grid"
 *   default | "list"), compared (draws the chosen ring), save and compare (the control slots),
 *   sizes (next/image `sizes` for this card's column), priority (first cards on the page), className.
 *   listedAgo, typeLabel ("Apartment", shown at the right of the foot) and summary are already-
 *   translated text from the page. Missing facts are left out,
 *   never shown blank or as zero.
 * Responsive: a column of picture over text. The list layout puts the picture beside the text when
 *   the card's own box is wide enough (a container query, not the screen width) and stacks below that.
 * Accessibility: the whole card is one link target: the title link is stretched over the card, while
 *   the heart and Compare stay separate focusable controls above it. A keyboard ring is drawn
 *   around the card when the title link has focus. The picture has the home's alt text.
 * States: default, hover (lift and zoom), focus, chosen for compare (ring), list, loading
 *   (PropertyCardSkeleton), picture missing or failed (illustrated tile).
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
  /** One or two sentences shown in the list layout only, already translated by the page. */
  summary?: string | undefined;
  cover?: { src: string; alt: string } | null | undefined;
};

type PropertyCardProps = {
  property: PropertyCardData;
  layout?: "grid" | "list";
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
  budget: "domain.propertyCard.label.budget",
} as const;

const DEFAULT_SIZES = "(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw";

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

  return (
    <div className={cn("@container h-full", className)}>
      <article
        data-slot="property-card"
        data-layout={layout}
        className={cn(
          "group/card relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface",
          "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
          "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
          compared ? "border-primary outline-1 outline-primary" : "border-line",
          list && "@2xl:flex-row",
        )}
      >
        <div
          className={cn(
            "relative aspect-4/3 shrink-0 overflow-hidden bg-canvas-sunken",
            list && "@2xl:aspect-auto @2xl:min-h-52 @2xl:w-2/5",
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
            {property.label ? (
              <Badge tone={property.label}>{translate(LABEL_KEYS[property.label])}</Badge>
            ) : null}
          </div>
        </div>
        {save}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* In the list layout the heart sits at the card's right edge, so the text keeps clear of it. */}
          <div
            className={cn(
              "flex flex-1 flex-col gap-2 px-4 pt-4 pb-3",
              list && "@2xl:p-5 @2xl:pr-14",
            )}
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
                list && "@2xl:border-t-0 @2xl:px-5 @2xl:pb-3",
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
  layout?: "grid" | "list";
  className?: string;
}) {
  const list = layout === "list";
  return (
    <div className={cn("@container h-full", className)} aria-hidden="true">
      <div
        data-slot="property-card-skeleton"
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
          list && "@2xl:flex-row",
        )}
      >
        <Skeleton
          className={cn(
            "aspect-4/3 w-full rounded-none",
            list && "@2xl:aspect-auto @2xl:min-h-52 @2xl:w-2/5",
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
export type { PropertyCardData };
