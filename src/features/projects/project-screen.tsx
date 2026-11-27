import {
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  Download,
  House,
  Layers,
  MapPin,
  Maximize2,
  MessageCircle,
  Phone,
  Ruler,
  Tag,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useId, type ReactNode } from "react";
import { CardCover } from "@/components/domain/property-card-controls.client";
import { PropertyGallery } from "@/components/domain/property-gallery";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { SpecTile } from "@/components/patterns/spec-tile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Price } from "@/components/ui/price";
import { formatAcres, formatMonth, formatPrice, type Translate } from "@/lib/format";
import { textParagraphs, uniqueTexts } from "@/lib/text";
import { PROJECTS_PATH } from "./address";
import { PriceTrend } from "./price-trend";
import type {
  PriceType,
  ProjectData,
  ProjectPlotStatus,
  ProjectPropertyType,
  ProjectStatus,
  ProjectVillaType,
} from "./types";
import { UnitsTable } from "./units-table";
import {
  bhkSizes,
  contactLinks,
  developerInitials,
  priceOf,
  reraReason,
  reraTag,
  specificationRows,
  specItems,
  unitsSummary,
  videoLinks,
  type SpecItem,
} from "./view";

const SPEC_ICONS: Record<SpecItem["key"], LucideIcon> = {
  price: Tag,
  propertyType: House,
  plotStatus: House,
  villaType: House,
  configuration: BedDouble,
  area: Maximize2,
  status: Building2,
  possession: CalendarDays,
  landArea: Ruler,
  totalUnits: Layers,
  availableUnits: CircleCheck,
  rera: BadgeCheck,
};

const SPEC_LABELS = {
  price: "projects.page.overview.price",
  propertyType: "projects.page.overview.propertyType",
  plotStatus: "projects.page.overview.plotStatus",
  villaType: "projects.page.overview.villaType",
  configuration: "projects.page.overview.configuration",
  area: "projects.page.overview.area",
  status: "projects.page.overview.status",
  possession: "projects.page.overview.possession",
  landArea: "projects.page.overview.landArea",
  totalUnits: "projects.page.overview.totalUnits",
  availableUnits: "projects.page.overview.availableUnits",
  rera: "projects.page.overview.rera",
} as const satisfies Record<SpecItem["key"], string>;

const PRICE_TYPE_WORDS = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
} as const satisfies Record<PriceType, string>;

const PROPERTY_TYPE_WORDS = {
  apartment: "projects.page.propertyType.apartment",
  villa: "projects.page.propertyType.villa",
  plot: "projects.page.propertyType.plot",
  vacant_land: "projects.page.propertyType.vacantLand",
  flat: "projects.page.propertyType.flat",
  office: "projects.page.propertyType.office",
  co_working: "projects.page.propertyType.coWorking",
} as const satisfies Record<ProjectPropertyType, string>;

const PLOT_STATUS_WORDS = {
  investment: "projects.page.plotStatus.investment",
  ready_to_build: "projects.page.plotStatus.readyToBuild",
} as const satisfies Record<ProjectPlotStatus, string>;

const VILLA_TYPE_WORDS = {
  duplex: "projects.page.villaType.duplex",
  row_house: "projects.page.villaType.rowHouse",
  individual: "projects.page.villaType.individual",
} as const satisfies Record<ProjectVillaType, string>;

const OFFER_WORDS = {
  sale: "domain.projectCard.offer.sale",
  rent: "domain.projectCard.offer.rent",
} as const;

const STATUS_WORDS = {
  new_launch: "domain.projectCard.status.newLaunch",
  under_construction: "domain.projectCard.status.underConstruction",
  ready_to_move: "domain.projectCard.status.readyToMove",
} as const satisfies Record<ProjectStatus, string>;

type ProjectScreenProps = {
  project: ProjectData;
  /** The address of each picture, in the order of `project.images` (the page builds them from storage). */
  imageSources: readonly string[];
  /** The address of each floor plan, in the order of `project.floorPlans`. */
  floorPlanSources: readonly string[];
  /** The address of the brochure, when the project has one. */
  brochureSource?: string | null | undefined;
  /** The enquiry card in the column beside the details (the page puts it behind its own Suspense). */
  enquiry?: ReactNode;
  /** Buttons under the title (the page gives them, so this feature needs no other). */
  actions?: ReactNode;
  /** The bar and sheet of a phone. */
  mobileEnquiry?: ReactNode;
  /** The extra boxes the super admin added, with this project's answers (the page works them out, ADR-168). */
  extras?: readonly { id: string; label: string; value: string }[];
  /** Prime under the admin's current amounts (ADR-208): the page works it out from the site settings. */
  prime?: boolean;
  /** Design Lab only: several screens on one board need a lower heading level. */
  titleAs?: "h1" | "h2";
};

/**
 * The project page below the site header (S4-T09, ADR-046): breadcrumb, gallery, the developer, the
 * title and its tags, Call, WhatsApp and Brochure, Project overview, About, Amenities, Specifications,
 * the units table, floor plans, the price trend, location and videos, and beside them the price card and
 * the enquiry. Every section the developer left empty is left out whole, never drawn as a blank. It
 * fetches nothing and holds no state, so the Design Lab draws every state with a sample project.
 */
export function ProjectScreen({
  project,
  imageSources,
  floorPlanSources,
  brochureSource,
  enquiry,
  actions,
  mobileEnquiry,
  extras = [],
  prime = false,
  titleAs = "h1",
}: ProjectScreenProps) {
  const ids = useId();
  const sectionId = (name: string) => `${ids}-${name}`;
  const translate = useTranslations();
  const words = translate as unknown as Translate;
  const locale = useLocale();

  const specs = specItems(project);
  const paragraphs = textParagraphs(project.description);
  const amenities = uniqueTexts(project.amenities);
  const specification = specificationRows(project.specifications);
  const summary = unitsSummary(project);
  const advantages = uniqueTexts(project.advantages);
  const nearby = uniqueTexts(project.nearby);
  const videos = videoLinks(project.videos);
  const rera = reraTag(project);
  const contact = contactLinks(project.contactPhone);
  const sizes = bhkSizes(project.bhkOptions);
  const priceFact = priceOf(project);
  const noRera = reraReason(project);

  const newTab = translate("common.opensInNewTab");
  const featuredBadge = project.featured ? (
    <Badge tone="featured">{translate("domain.projectCard.featured")}</Badge>
  ) : null;
  const primeBadge = prime ? (
    <Badge tone="prime">{translate("domain.projectCard.prime")}</Badge>
  ) : null;
  const statusBadge =
    project.status === null ? null : (
      <Badge tone="outline">{translate(STATUS_WORDS[project.status])}</Badge>
    );

  const photos = project.images.map((_, index) => ({
    src: imageSources[index] ?? "",
    alt: translate("projects.page.photoAlt", { name: project.name, number: index + 1 }),
  }));

  /** The one price with what it means ("₹8,500 per sq ft"); a price with no known type stands alone. */
  function priceWords(rupees: number, type: PriceType | null): string {
    const amount = formatPrice(words, locale, rupees);
    return type === null ? amount : translate(PRICE_TYPE_WORDS[type], { price: amount });
  }

  function priceText(): string | null {
    return priceFact === null ? null : priceWords(priceFact.rupees, priceFact.type);
  }

  function specValue(item: SpecItem): ReactNode {
    switch (item.key) {
      case "price":
        return priceWords(item.rupees, item.type);
      case "propertyType":
        return translate(PROPERTY_TYPE_WORDS[item.value]);
      case "plotStatus":
        return translate(PLOT_STATUS_WORDS[item.value]);
      case "villaType":
        return translate(VILLA_TYPE_WORDS[item.value]);
      case "area": {
        const number = new Intl.NumberFormat(locale);
        return translate("projects.page.overview.areaRange", {
          min: number.format(item.min),
          max: number.format(item.max),
        });
      }
      case "configuration":
        return translate("projects.page.overview.bhk", { sizes: item.sizes.join(", ") });
      case "status":
        return translate(STATUS_WORDS[item.value]);
      case "possession":
        return formatMonth(locale, item.date);
      case "landArea":
        return formatAcres(words, locale, item.acres);
      case "totalUnits":
      case "availableUnits":
        return item.value;
      case "rera":
        // A registration number can be long: it may break after a slash, never in the middle of a part.
        return item.number.split("/").map((part, index, parts) => (
          <Fragment key={`${index}-${part}`}>
            {part}
            {index < parts.length - 1 ? (
              <>
                /<wbr />
              </>
            ) : null}
          </Fragment>
        ));
    }
  }

  // The line under the price in the side card: a rent project's deposit and maintenance (ADR-214), the sizes on offer,
  // then when it is ready.
  const asideParts: string[] = [];
  if (project.securityDeposit !== null) {
    asideParts.push(
      translate("projects.page.aside.deposit", {
        amount: formatPrice(words, locale, project.securityDeposit),
      }),
    );
  }
  if (project.maintenancePerMonth !== null) {
    asideParts.push(
      translate("projects.page.aside.maintenance", {
        amount: formatPrice(words, locale, project.maintenancePerMonth),
      }),
    );
  }
  if (sizes.length > 0) {
    asideParts.push(
      translate("projects.page.overview.bhk", {
        sizes: new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
          sizes.map(String),
        ),
      }),
    );
  }
  if (project.possessionDate !== null) {
    const date = formatMonth(locale, project.possessionDate);
    if (date !== "") asideParts.push(translate("projects.page.aside.possession", { date }));
  }
  const price = priceText();
  const hasPriceCard =
    price !== null || featuredBadge !== null || primeBadge !== null || statusBadge !== null;

  const gallery =
    photos.length === 0 ? null : (
      <PropertyGallery
        photos={photos}
        badges={featuredBadge}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
      />
    );

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("projects.page.crumb.nav")}
        backLabel={translate("projects.page.crumb.back")}
        items={[
          { label: translate("projects.page.crumb.home"), href: "/" },
          { label: translate("projects.page.crumb.projects"), href: PROJECTS_PATH },
          { label: project.name },
        ]}
        className="mb-4"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--w-detail-aside)] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-3">
            <span className="flex items-center gap-3 text-small font-semibold text-ink">
              <Avatar size="sm">
                <AvatarFallback>{developerInitials(project.developer.name)}</AvatarFallback>
              </Avatar>
              {project.developer.name}
            </span>
            <Heading as={titleAs} size="1">
              {project.name}
            </Heading>
            <div className="flex flex-wrap gap-2">
              <Badge tone="outline">
                <Icon icon={MapPin} size="sm" />
                {project.locality}
              </Badge>
              {rera === null ? null : (
                <Badge tone="outline">
                  <Icon icon={BadgeCheck} size="sm" />
                  {rera.number === null
                    ? translate("projects.page.reraTagBare")
                    : translate("projects.page.reraTag", { number: rera.number })}
                </Badge>
              )}
              {project.offerType === null ? null : (
                <Badge tone="outline">{translate(OFFER_WORDS[project.offerType])}</Badge>
              )}
            </div>
            {noRera === null ? null : (
              <p className="text-small text-muted">
                {translate("projects.page.reraNotApplicable", { reason: noRera })}
              </p>
            )}
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </header>

          {gallery}

          {contact.call === null && brochureSource == null ? null : (
            <div className="flex flex-wrap gap-3">
              {contact.call === null ? null : (
                <Button asChild variant="primary">
                  <Link
                    href={contact.call}
                    className="text-on-primary no-underline hover:text-on-primary"
                  >
                    <Icon icon={Phone} size="sm" />
                    {translate("projects.page.actions.call")}
                  </Link>
                </Button>
              )}
              {contact.whatsapp === null ? null : (
                <Button asChild variant="secondary">
                  <Link
                    href={contact.whatsapp}
                    external
                    newTabLabel={newTab}
                    className="text-primary no-underline hover:text-primary"
                  >
                    <Icon icon={MessageCircle} size="sm" />
                    {translate("projects.page.actions.whatsapp")}
                  </Link>
                </Button>
              )}
              {brochureSource == null ? null : (
                <Button asChild variant="secondary">
                  <Link
                    href={brochureSource}
                    external
                    newTabLabel={newTab}
                    className="text-primary no-underline hover:text-primary"
                  >
                    <Icon icon={Download} size="sm" />
                    {translate("projects.page.actions.brochure")}
                  </Link>
                </Button>
              )}
            </div>
          )}

          {specs.length === 0 ? null : (
            <section aria-labelledby={sectionId("overview")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("overview")}>
                {translate("projects.page.overview.heading")}
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
            </section>
          )}

          {extras.length === 0 ? null : (
            <section aria-labelledby={sectionId("extras")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("extras")}>
                {translate("projects.page.extras.heading")}
              </Heading>
              <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {extras.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1 rounded-md bg-canvas-sunken p-4">
                    <dt className="text-small text-muted">{row.label}</dt>
                    <dd className="font-bold whitespace-pre-line text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {paragraphs.length === 0 ? null : (
            <section aria-labelledby={sectionId("about")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("about")}>
                {translate("projects.page.about")}
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
                {translate("projects.page.amenities")}
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

          {specification === null ? null : (
            <section aria-labelledby={sectionId("specs")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("specs")}>
                {translate("projects.page.specifications")}
              </Heading>
              {specification.kind === "pairs" ? (
                <dl className="grid max-w-3xl gap-x-6 gap-y-3 md:grid-cols-[max-content_minmax(0,1fr)]">
                  {specification.rows.map((row, index) => (
                    <div key={`${index}-${row.name}`} className="contents">
                      <dt className="text-small font-semibold text-muted">{row.name}</dt>
                      <dd className="text-body text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="flex max-w-[70ch] flex-col gap-4 text-body whitespace-pre-line text-ink">
                  {specification.paragraphs.map((paragraph, index) => (
                    <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
                  ))}
                </div>
              )}
            </section>
          )}

          {summary === null ? null : (
            <section aria-labelledby={sectionId("units")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("units")}>
                {translate("projects.page.units.heading")}
              </Heading>
              <UnitsTable
                units={project.units}
                total={summary.total}
                labelledBy={sectionId("units")}
              />
            </section>
          )}

          {floorPlanSources.length === 0 ? null : (
            <section aria-labelledby={sectionId("plans")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("plans")}>
                {translate("projects.page.floorPlans.heading")}
              </Heading>
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {floorPlanSources.map((source, index) => {
                  const name = translate("projects.page.floorPlans.item", { number: index + 1 });
                  return (
                    <li key={source}>
                      <Link
                        href={source}
                        external
                        newTabLabel={newTab}
                        className="flex flex-col gap-2 text-small font-semibold text-primary no-underline hover:text-primary"
                      >
                        <span className="relative block aspect-4/3 overflow-hidden rounded-lg border border-line bg-canvas-sunken">
                          <CardCover src={source} alt="" sizes="(min-width: 768px) 30vw, 50vw" />
                        </span>
                        <span>{name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <PriceTrend points={project.trend} headingId={sectionId("trend")} />

          {advantages.length === 0 && nearby.length === 0 ? null : (
            <section aria-labelledby={sectionId("location")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("location")}>
                {translate("projects.page.location.heading")}
              </Heading>
              {advantages.length === 0 ? null : (
                <ul className="flex flex-wrap gap-2">
                  {advantages.map((advantage) => (
                    <li key={advantage}>
                      <Badge tone="outline">{advantage}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {nearby.length === 0 ? null : (
                <div className="flex flex-col gap-2">
                  <Heading as="h3" size="3">
                    {translate("projects.page.location.nearby")}
                  </Heading>
                  <ul className="flex flex-wrap gap-2">
                    {nearby.map((place) => (
                      <li key={place}>
                        <Badge tone="outline">
                          <Icon icon={MapPin} size="sm" />
                          {place}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {videos.length === 0 ? null : (
            <section aria-labelledby={sectionId("videos")} className="flex flex-col gap-4">
              <Heading as="h2" size="3" id={sectionId("videos")}>
                {translate("projects.page.videos.heading")}
              </Heading>
              <ul className="flex flex-col gap-3">
                {videos.map((video, index) => (
                  <li key={video}>
                    <Link
                      href={video}
                      external
                      newTabLabel={newTab}
                      className="inline-flex items-center gap-2 text-body"
                    >
                      <Icon icon={Video} size="sm" />
                      {translate("projects.page.videos.item", { number: index + 1 })}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {hasPriceCard || enquiry ? (
          <aside
            aria-label={translate("projects.page.aside.label")}
            className="flex flex-col gap-4 self-start lg:sticky lg:top-24"
          >
            {hasPriceCard ? (
              <div
                data-slot="project-price-card"
                className="rounded-xl border border-line bg-surface p-6 pb-5"
              >
                {featuredBadge === null && primeBadge === null && statusBadge === null ? null : (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {featuredBadge}
                    {primeBadge}
                    {statusBadge}
                  </div>
                )}
                {price === null ? null : <Price size="large">{price}</Price>}
                {asideParts.length === 0 ? null : (
                  <p className="mt-2 text-small text-muted">{asideParts.join(" · ")}</p>
                )}
              </div>
            ) : null}
            {enquiry}
          </aside>
        ) : null}
      </div>
      {mobileEnquiry}
    </Container>
  );
}
