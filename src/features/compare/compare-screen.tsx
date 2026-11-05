import { CircleCheck, Minus } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { EmptyState } from "@/components/patterns/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { PROPERTY_TYPE_WORDS } from "@/config/search-options";
import { cn } from "@/lib/cn";
import { formatArea, formatPerSqft, formatPrice, formatRent, type Translate } from "@/lib/format";
import { CompareRemove } from "./compare-remove.client";
import { amenityRows, hasAmenity, type CompareColumn } from "./table";

const FURNISHING_WORDS = {
  unfurnished: "property.page.furnishing.unfurnished",
  semi: "property.page.furnishing.semi",
  full: "property.page.furnishing.full",
} as const;

const LABEL_WORDS = {
  featured: "domain.propertyCard.label.featured",
  prime: "domain.propertyCard.label.prime",
  budget: "domain.propertyCard.label.budget",
} as const;

type CompareScreenProps = {
  /** The homes found, in the order of the address; at most three. */
  columns: readonly CompareColumn[];
  /** Design Lab only: nothing navigates or is forgotten. */
  preview?: boolean;
  /** Design Lab only: a lower heading level, so several screens share a board. */
  titleAs?: "h1" | "h2";
};

const CELL = "p-4 align-top text-body text-ink";
const ROW_HEAD =
  "sticky left-0 z-10 w-36 min-w-36 bg-surface p-4 text-left align-top text-small font-semibold text-muted";

/**
 * The comparison below the site header (S4-T02, ADR-044, FR-PUB-10): breadcrumb, heading and line, and
 * one table with a label column and a column for each home (two or three): a picture, the tags, the
 * title, the price, "View home" and Remove; then Overview, Facts and one row for every amenity any of
 * the homes has, with Yes or Not listed. On a phone the table scrolls sideways and the label column
 * stays. Fewer than two homes is the empty state. It fetches nothing: the page gives it the columns.
 */
export function CompareScreen({ columns, preview = false, titleAs = "h1" }: CompareScreenProps) {
  const translate = useTranslations();
  const words = translate as unknown as Translate;
  const locale = useLocale();
  const ready = columns.length >= 2;
  const allIds = columns.map((column) => column.shortId);
  const amenities = amenityRows(columns);

  const notListed = (
    <span className="inline-flex items-center gap-2 text-muted">
      <Icon icon={Minus} size="sm" />
      {translate("compare.table.notListed")}
    </span>
  );

  function section(label: string) {
    return (
      <tr>
        <th
          scope="row"
          className="sticky left-0 z-10 bg-primary-tint px-4 py-2 text-left text-small font-bold text-primary"
        >
          {label}
        </th>
        <td colSpan={columns.length} className="bg-primary-tint" />
      </tr>
    );
  }

  function row(label: string, cell: (column: CompareColumn) => React.ReactNode) {
    return (
      <tr className="border-t border-line">
        <th scope="row" className={ROW_HEAD}>
          {label}
        </th>
        {columns.map((column) => (
          <td key={column.shortId} className={CELL}>
            {cell(column)}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("compare.crumb.nav")}
        backLabel={translate("compare.crumb.back")}
        items={[
          { label: translate("compare.crumb.home"), href: "/" },
          { label: translate("compare.crumb.properties"), href: "/properties" },
          { label: translate("compare.crumb.current") },
        ]}
        className="mb-4"
      />
      <header className="mb-6 flex flex-col gap-2">
        <Heading as={titleAs} size="1">
          <TitleWithEmphasis
            title={translate("compare.title")}
            emphasis={translate("compare.emphasis")}
          />
        </Heading>
        <p className="text-body text-muted">{translate("compare.subtitle")}</p>
      </header>

      {ready ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table
              aria-label={translate("compare.table.label", { count: columns.length })}
              className={cn(
                "w-full table-fixed border-collapse text-left",
                columns.length > 2 ? "min-w-2xl" : "min-w-lg",
              )}
            >
              <thead>
                <tr>
                  <th scope="col" className={ROW_HEAD}>
                    <span className="sr-only">{translate("compare.table.corner")}</span>
                  </th>
                  {columns.map((column) => (
                    <td key={column.shortId} className="p-4 align-top">
                      <div className="flex flex-col gap-3">
                        <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-canvas-sunken">
                          {column.cover ? (
                            <Image
                              src={column.cover}
                              alt=""
                              fill
                              sizes="(min-width: 1024px) 30vw, 70vw"
                              unoptimized={column.cover.endsWith(".svg")}
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="outline">
                            {translate(
                              column.listingType === "sale"
                                ? "domain.propertyCard.forSale"
                                : "domain.propertyCard.forRent",
                            )}
                          </Badge>
                          {column.label === null ? null : (
                            <Badge tone={column.label}>
                              {translate(LABEL_WORDS[column.label])}
                            </Badge>
                          )}
                        </div>
                        <Heading as={titleAs === "h1" ? "h2" : "h3"} size="3">
                          <Link
                            href={column.href}
                            className="text-primary no-underline hover:underline"
                          >
                            {column.title}
                          </Link>
                        </Heading>
                        <p className="text-title text-ink">
                          {column.listingType === "sale"
                            ? formatPrice(words, locale, column.price)
                            : formatRent(words, locale, column.price)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild size="sm">
                            <Link
                              href={column.href}
                              className="text-on-primary no-underline hover:text-on-primary"
                            >
                              {translate("compare.table.viewHome")}
                            </Link>
                          </Button>
                          <CompareRemove
                            shortId={column.shortId}
                            title={column.title}
                            cover={column.cover}
                            allIds={allIds}
                            preview={preview}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section(translate("compare.table.overview"))}
                {row(translate("compare.table.price"), (column) => (
                  <b>
                    {column.listingType === "sale"
                      ? formatPrice(words, locale, column.price)
                      : formatRent(words, locale, column.price)}
                  </b>
                ))}
                {row(translate("compare.table.perSqft"), (column) =>
                  column.perSqftRupees === undefined ? (
                    <span className="text-muted">{translate("compare.table.notApplicable")}</span>
                  ) : (
                    formatPerSqft(words, locale, column.perSqftRupees)
                  ),
                )}
                {row(translate("compare.table.propertyType"), (column) =>
                  translate(PROPERTY_TYPE_WORDS[column.propertyType]),
                )}
                {section(translate("compare.table.facts"))}
                {row(translate("compare.table.locality"), (column) => column.place ?? notListed)}
                {row(translate("compare.table.area"), (column) =>
                  column.areaSqft === null ? notListed : formatArea(words, locale, column.areaSqft),
                )}
                {row(translate("compare.table.bedrooms"), (column) =>
                  column.bedrooms === null
                    ? notListed
                    : translate("property.bhk", { count: column.bedrooms }),
                )}
                {row(translate("compare.table.bathrooms"), (column) =>
                  column.bathrooms === null ? notListed : column.bathrooms,
                )}
                {row(translate("compare.table.furnishing"), (column) =>
                  column.furnishing === null
                    ? notListed
                    : translate(FURNISHING_WORDS[column.furnishing]),
                )}
                {amenities.length === 0 ? null : section(translate("compare.table.amenities"))}
                {amenities.map((amenity) =>
                  row(amenity, (column) =>
                    hasAmenity(column, amenity) ? (
                      <span className="inline-flex items-center gap-2 font-semibold text-success">
                        <Icon icon={CircleCheck} size="sm" />
                        {translate("compare.table.yes")}
                      </span>
                    ) : (
                      notListed
                    ),
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-small text-muted max-md:hidden">{translate("compare.tip")}</p>
        </>
      ) : (
        <EmptyState
          as={titleAs === "h1" ? "h2" : "h3"}
          title={translate("compare.empty.title")}
          description={translate(
            columns.length === 1 ? "compare.empty.bodyOne" : "compare.empty.bodyNone",
          )}
        >
          <Button asChild>
            <Link href="/properties" className="text-on-primary no-underline hover:text-on-primary">
              {translate("compare.empty.browse")}
            </Link>
          </Button>
        </EmptyState>
      )}
    </Container>
  );
}
