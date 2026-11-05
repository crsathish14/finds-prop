import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { Container } from "@/components/layout/container";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import type { Translate } from "@/lib/format";
import type { CuratedLocality } from "./from-card";
import { ResultsList, ResultsRail, ResultsToolbar } from "./results-controls.client";
import { resultsHeading, resultsPlace } from "./results-view";
import { SearchNavigationProvider } from "./search-navigation.client";
import { SEARCH_PATH, type SearchParams } from "./schemas";

type ResultsScreenProps = {
  params: SearchParams;
  /** "failed" when the read failed: the alert is drawn and the filters are kept. */
  status: "ok" | "failed";
  /** How many homes match in all (the function's own count). */
  total: number;
  /** The cards of this page, already made by the page. */
  cards: ReactNode;
  /** How many cards there are. */
  shown: number;
  /** The curated localities of the site content: the Locality choices of the filters. */
  localities: readonly CuratedLocality[];
  /** The region's name, when the site content has one (DEC-14); the words stay neutral without it. */
  regionName?: string | undefined;
  /** Where "Describe it in words" leads; leave it out while AI search is off. */
  describeHref?: string | undefined;
  /** Design Lab only: nothing navigates. */
  preview?: boolean;
  /** Design Lab only: several screens on one board need their own heading level and id. */
  titleAs?: "h1" | "h2";
  titleId?: string;
};

/**
 * The results page below the site header (S4-T04): the breadcrumb, the heading and the count, the
 * filter rail beside the bar and the list. It reads everything from the parsed address and the
 * results it is given and fetches nothing, so the Design Lab can draw every state with sample data.
 * Count and heading follow the UX: "Apartments for sale in Velachery", "48 homes found in Velachery".
 */
export function ResultsScreen({
  params,
  status,
  total,
  cards,
  shown,
  localities,
  regionName,
  describeHref,
  preview = false,
  titleAs = "h1",
  titleId = "results-title",
}: ResultsScreenProps) {
  const translate = useTranslations();
  const words = translate as unknown as Translate;
  const heading = resultsHeading(params, words);
  const place = resultsPlace(params);
  const allLocalitiesLabel = regionName
    ? translate("results.allLocalitiesIn", { region: regionName })
    : translate("results.allLocalities");

  const count = translate("results.count", { count: total });
  let found: string | null = null;
  if (status === "ok") {
    if (total === 0) found = translate("results.matchFilters", { count: total });
    else if (place === undefined) found = translate("results.found");
    else if (regionName) found = translate("results.foundInRegion", { place, region: regionName });
    else found = translate("results.foundIn", { place });
  }

  return (
    <SearchNavigationProvider params={params} preview={preview}>
      <Container className="py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-2">
          <Breadcrumb
            navLabel={translate("results.crumb.nav")}
            backLabel={translate(
              place === undefined ? "results.crumb.backHome" : "results.crumb.backProperties",
            )}
            items={[
              { label: translate("results.crumb.home"), href: "/" },
              place === undefined
                ? { label: translate("results.crumb.properties") }
                : { label: translate("results.crumb.properties"), href: SEARCH_PATH },
              ...(place === undefined ? [] : [{ label: place }]),
            ]}
          />
          <Heading as={titleAs} size="1" id={titleId} tabIndex={-1}>
            <TitleWithEmphasis title={heading.title} emphasis={heading.emphasis} />
          </Heading>
          {found === null ? null : (
            <p aria-live="polite" className="text-body text-muted">
              <b className="text-ink">{count}</b> {found}
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <div className="hidden self-start lg:sticky lg:top-24 lg:block">
            <ResultsRail localities={localities} allLocalitiesLabel={allLocalitiesLabel} />
          </div>
          <section
            aria-label={translate("results.title.label")}
            className="flex min-w-0 flex-col gap-6"
          >
            <ResultsToolbar
              localities={localities}
              allLocalitiesLabel={allLocalitiesLabel}
              total={status === "ok" ? total : null}
            />
            <ResultsList status={status} total={total} shown={shown} describeHref={describeHref}>
              {cards}
            </ResultsList>
          </section>
        </div>
      </Container>
    </SearchNavigationProvider>
  );
}
