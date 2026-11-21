import { useTranslations } from "next-intl";
import { FaqAccordion, type FaqAccordionGroup } from "@/components/domain/faq-accordion.client";
import { FaqFilterBar } from "@/components/domain/faq-filter-bar";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { JsonLd } from "@/features/seo";
import { faqPageDocument } from "./json-ld";
import { faqHref, FAQ_PATH, type PublicFaqParams } from "./page-params";
import { answerParagraphs, groupFaqs, type FaqView } from "./view";

type FaqScreenProps = {
  /** The questions to show, in the database function's order (category, then question order, or best match first). */
  faqs: FaqView[];
  /** The categories that have a published question, for the chips (never a category with nothing in it). */
  categories: { slug: string; name: string }[];
  /** What was asked for. A category that does not exist has already been dropped. */
  params: PublicFaqParams;
  /** True when there is no published question at all (not only none for this search). */
  nothingPublished: boolean;
};

/**
 * The public FAQ page below the header (ADR-143): the breadcrumb, the title, the search box and category chips, the
 * questions grouped by category as accordions, and a line to the contact page. Search and category are in the address
 * (`faqHref`), so a link to them works without scripts. Every state is drawn: questions, none yet, no match. The page
 * hands it what to show, so it reads nothing itself. The structured data (FAQPage) is of the questions shown.
 */
export function FaqScreen({ faqs, categories, params, nothingPublished }: FaqScreenProps) {
  const translate = useTranslations("faq");
  const groups = groupFaqs(faqs);
  const accordionGroups: FaqAccordionGroup[] = groups.map((group) => ({
    slug: group.slug,
    name: group.name,
    countLabel: translate("groupCount", { count: group.items.length }),
    items: group.items.map((faq) => ({
      id: faq.id,
      question: faq.question,
      paragraphs: answerParagraphs(faq.answer),
    })),
  }));

  const filtering = params.query !== "" || params.category !== "";
  const categoryName = categories.find((category) => category.slug === params.category)?.name;
  const count = faqs.length;
  const summary =
    params.query !== "" && categoryName
      ? translate("summary.queryInCategory", { count, query: params.query, category: categoryName })
      : params.query !== ""
        ? translate("summary.query", { count, query: params.query })
        : categoryName
          ? translate("summary.inCategory", { count, category: categoryName })
          : translate("summary.all", { count });

  return (
    <Container className="py-6 md:py-8">
      {faqs.length > 0 ? <JsonLd data={faqPageDocument(faqs)} /> : null}
      <Breadcrumb
        navLabel={translate("crumb.nav")}
        backLabel={translate("crumb.backHome")}
        items={[{ label: translate("crumb.home"), href: "/" }, { label: translate("crumb.faq") }]}
      />
      <div className="mt-6 mb-6 flex max-w-3xl flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("lead")}</Text>
      </div>
      {nothingPublished ? (
        <EmptyState title={translate("empty.title")} description={translate("empty.text")}>
          <Button asChild variant="primary">
            <Link href="/contact" variant="nav" className="no-underline">
              {translate("help.link")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="flex max-w-3xl flex-col gap-8">
          <FaqFilterBar
            search={{
              label: translate("search.label"),
              placeholder: translate("search.placeholder"),
              submitLabel: translate("search.submit"),
              value: params.query,
              name: "q",
              action: FAQ_PATH,
              hidden: params.category ? [{ name: "category", value: params.category }] : [],
            }}
            categories={{
              label: translate("categories.label"),
              all: {
                label: translate("categories.all"),
                href: faqHref({ query: params.query }),
                selected: params.category === "",
              },
              options: categories.map((category) => ({
                slug: category.slug,
                label: category.name,
                href: faqHref({ query: params.query, category: category.slug }),
                selected: params.category === category.slug,
              })),
            }}
            summary={summary}
            {...(filtering ? { clear: { label: translate("clear"), href: FAQ_PATH } } : {})}
          />
          {faqs.length === 0 ? (
            <EmptyState
              title={translate("noMatches.title")}
              description={translate("noMatches.text")}
            >
              <Button asChild variant="primary">
                <Link href={FAQ_PATH} variant="nav" className="no-underline">
                  {translate("noMatches.showAll")}
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <FaqAccordion groups={accordionGroups} />
          )}
          <aside
            aria-labelledby="faq-help-title"
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6"
          >
            <h2 id="faq-help-title" className="text-title font-bold text-ink">
              {translate("help.title")}
            </h2>
            <Text tone="muted">{translate("help.text")}</Text>
            <Link href="/contact" variant="arrow">
              {translate("help.link")}
            </Link>
          </aside>
        </div>
      )}
    </Container>
  );
}
