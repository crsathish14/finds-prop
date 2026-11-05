import {
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Info,
  MapPin,
  Ruler,
  Sofa,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { PriceCard } from "@/components/domain/price-card";
import { PropertyGallery } from "@/components/domain/property-gallery";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { SpecTile } from "@/components/patterns/spec-tile";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { PROPERTY_TYPE_WORDS } from "@/config/search-options";
import { formatArea, formatListedAgo, type Translate } from "@/lib/format";
import { PROPERTIES_PATH } from "./address";
import type { PropertyData } from "./types";
import {
  amenityList,
  descriptionParagraphs,
  hasLeftOutDetails,
  perSqftRupees,
  placeLine,
  specItems,
  type SpecItem,
} from "./view";

const SPEC_ICONS: Record<SpecItem["key"], LucideIcon> = {
  bedrooms: BedDouble,
  bathrooms: Bath,
  area: Ruler,
  propertyType: Building2,
  furnishing: Sofa,
  listed: CalendarDays,
};

const SPEC_LABELS = {
  bedrooms: "property.page.specs.bedrooms",
  bathrooms: "property.page.specs.bathrooms",
  area: "property.page.specs.area",
  propertyType: "property.page.specs.propertyType",
  furnishing: "property.page.specs.furnishing",
  listed: "property.page.specs.listed",
} as const satisfies Record<SpecItem["key"], string>;

const LABEL_WORDS = {
  featured: "domain.propertyCard.label.featured",
  prime: "domain.propertyCard.label.prime",
  budget: "domain.propertyCard.label.budget",
} as const;

const FURNISHING_WORDS = {
  unfurnished: "property.page.furnishing.unfurnished",
  semi: "property.page.furnishing.semi",
  full: "property.page.furnishing.full",
} as const;

type PropertyScreenProps = {
  property: PropertyData;
  /** The address of each photo, in the order of `property.photos` (the page builds them from storage). */
  photoSources: readonly string[];
  /** The enquiry card beside the details; the page puts it behind its own Suspense. */
  enquiry: ReactNode;
  /** The bar and sheet of a phone. */
  mobileEnquiry: ReactNode;
  /** Design Lab only: several screens on one board need a lower heading level. */
  titleAs?: "h1" | "h2";
};

/**
 * The property page below the site header (S4-T03, ADR-043): breadcrumb, gallery with its badges, title
 * and place, "At a glance", the description, the amenities, and beside them (from 1024 px) the price card
 * and the enquiry card. A phone has the sticky bar instead. It fetches nothing and holds no state: the
 * page gives it the home and the two enquiry pieces, so the Design Lab can draw every state with sample
 * data. Anything the owner did not give is left out, never drawn as a blank. No Save or Compare buttons
 * yet (S5-T01, S4-T02).
 */
export function PropertyScreen({
  property,
  photoSources,
  enquiry,
  mobileEnquiry,
  titleAs = "h1",
}: PropertyScreenProps) {
  const ids = useId();
  const sectionId = (name: string) => `${ids}-${name}`;
  const translate = useTranslations();
  const words = translate as unknown as Translate;
  const locale = useLocale();
  const place = placeLine(property);
  const specs = specItems(property);
  const paragraphs = descriptionParagraphs(property.description);
  const amenities = amenityList(property.amenities);
  const listedAgo = property.ageDays === null ? null : formatListedAgo(words, property.ageDays);

  const where = place.line === "" ? null : place.line;
  let locationLine: string | null = null;
  if (where !== null && listedAgo !== null) {
    locationLine = translate("property.page.location", { place: where, ago: listedAgo });
  } else if (where !== null) {
    locationLine = where;
  } else if (listedAgo !== null) {
    locationLine = translate("property.page.listedOnly", { ago: listedAgo });
  }

  const badges = (
    <>
      <Badge tone="outline">
        {translate(
          property.listingType === "sale"
            ? "domain.propertyCard.forSale"
            : "domain.propertyCard.forRent",
        )}
      </Badge>
      {property.label === null ? null : (
        <Badge tone={property.label}>{translate(LABEL_WORDS[property.label])}</Badge>
      )}
    </>
  );

  const photos = property.photos.map((photo, index) => ({
    src: photoSources[index] ?? "",
    alt:
      photo.alt ??
      translate("property.page.photoAlt", { title: property.title, number: index + 1 }),
  }));

  function specValue(item: SpecItem): ReactNode {
    switch (item.key) {
      case "bedrooms":
        return translate("property.bhk", { count: item.value });
      case "bathrooms":
        return item.value;
      case "area":
        return formatArea(words, locale, item.value);
      case "propertyType":
        return translate(PROPERTY_TYPE_WORDS[item.value]);
      case "furnishing":
        return translate(FURNISHING_WORDS[item.value]);
      case "listed":
        return formatListedAgo(words, item.value);
    }
  }

  const crumbs = [
    { label: translate("property.page.crumb.home"), href: "/" },
    place.locality === null
      ? { label: translate("property.page.crumb.properties") }
      : { label: translate("property.page.crumb.properties"), href: PROPERTIES_PATH },
    ...(place.locality === null ? [] : [{ label: place.locality }]),
  ];

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("property.page.crumb.nav")}
        backLabel={translate("property.page.crumb.back")}
        items={crumbs}
        className="mb-4"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--w-detail-aside)] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <PropertyGallery
            photos={photos}
            badges={badges}
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
          />

          <header className="flex flex-col gap-2">
            <Heading as={titleAs} size="1">
              {property.title}
            </Heading>
            {locationLine === null ? null : (
              <p className="flex items-start gap-2 text-body text-muted">
                <Icon icon={MapPin} className="mt-1" />
                <span>{locationLine}</span>
              </p>
            )}
          </header>

          <section aria-labelledby={sectionId("specs")} className="flex flex-col gap-4">
            <Heading as="h2" size="3" id={sectionId("specs")}>
              {translate("property.page.specs.heading")}
            </Heading>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {specs.map((item) => (
                <SpecTile
                  key={item.key}
                  label={translate(SPEC_LABELS[item.key])}
                  value={specValue(item)}
                  icon={<Icon icon={SPEC_ICONS[item.key]} />}
                  iconFrom="md"
                />
              ))}
            </div>
            {hasLeftOutDetails(property) ? (
              <p className="flex items-start gap-2 text-small text-muted">
                <Icon icon={Info} size="sm" className="mt-1" />
                <span>{translate("property.page.specs.leftOut")}</span>
              </p>
            ) : null}
          </section>

          {paragraphs.length === 0 ? null : (
            <section aria-labelledby={sectionId("about")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("about")}>
                {translate("property.page.about")}
              </Heading>
              <div className="flex max-w-[70ch] flex-col gap-4 text-body whitespace-pre-line text-ink">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {amenities.length === 0 ? null : (
            <section aria-labelledby={sectionId("amenities")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("amenities")}>
                {translate("property.page.amenities")}
              </Heading>
              <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {amenities.map((amenity) => (
                  <li key={amenity} className="flex items-start gap-2 text-body text-ink">
                    <Icon icon={Check} className="mt-1 text-primary" />
                    <span>{amenity}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside
          aria-label={translate("property.page.aside.label")}
          className="hidden self-start lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4"
        >
          <PriceCard
            rupees={property.price}
            listingType={property.listingType}
            perSqftRupees={perSqftRupees(property)}
            badges={badges}
          />
          {enquiry}
          <p className="flex items-start gap-2 text-small text-muted">
            <Icon icon={Info} size="sm" className="mt-1" />
            <span>{translate("property.page.aside.note")}</span>
          </p>
        </aside>
      </div>
      {mobileEnquiry}
    </Container>
  );
}
