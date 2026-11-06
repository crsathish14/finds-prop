import { useLocale, useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/patterns/alert";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { formatDate, type Translate } from "@/lib/format";
import { contentsOf, legalDocument } from "./documents";
import { LEGAL_KINDS, LEGAL_PATHS, type LegalBlock, type LegalKind } from "./types";
import { legalTitle } from "./words";

type LegalPageProps = {
  kind: LegalKind;
  /** Design Lab only: show the phone's "On this page" list open. */
  contentsOpen?: boolean;
  /** Design Lab only: several pages on one board need their own heading level and id. */
  titleAs?: "h1" | "h2";
  titleId?: string;
};

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "paragraph") return <Text className="mb-4">{block.text}</Text>;
  if (block.type === "list") {
    return (
      <ul className="mb-4 list-disc space-y-2 pl-6 text-body">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div role="region" aria-label={block.caption} tabIndex={0} className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-small">
        <caption className="sr-only">{block.caption}</caption>
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="border-b border-line-strong px-4 py-3 font-bold"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row" className="border-b border-line px-4 py-3 font-bold">
                    {cell}
                  </th>
                ) : (
                  <td key={cell} className="border-b border-line px-4 py-3 text-muted">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One of the three legal pages in the shared reading layout (ADR-053, ADD-12): the breadcrumb, a switch
 * between Privacy Policy, Terms of Use and Cookie information, the title with when it was last changed, a
 * summary, and numbered sections beside an "On this page" list (a column from 1024 px, a closed list on
 * a phone). The text is in `content/`. While the text is a placeholder (`draft`), the page says so
 * on its face. It fetches nothing, so the Design Lab draws every page.
 */
export function LegalPage({
  kind,
  contentsOpen = false,
  titleAs = "h1",
  titleId = "legal-title",
}: LegalPageProps) {
  const translate = useTranslations("legal");
  // The same cast the helpers' own tests use: next-intl's strict translator type is wider than Translate.
  const everything = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const document = legalDocument(kind);
  const contents = contentsOf(document.sections);
  const title = legalTitle(everything, kind);
  const updated =
    document.updated === null
      ? null
      : translate("updated", {
          date: formatDate(locale, new Date(document.updated + "T00:00:00Z"), "long"),
        });
  const version =
    document.version === null ? null : translate("version", { version: document.version });

  const contentsList = (
    <ol className="flex flex-col gap-2 text-small">
      {contents.map((entry) => {
        const anchor = "#" + entry.id;
        return (
          <li key={entry.id}>
            <Link href={anchor}>
              {entry.number}. {entry.heading}
            </Link>
          </li>
        );
      })}
    </ol>
  );

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("crumb.nav")}
        backLabel={translate("crumb.backHome")}
        items={[{ label: translate("crumb.home"), href: "/" }, { label: title }]}
      />
      <nav aria-label={translate("switcher")} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {LEGAL_KINDS.map((other) => (
          <Link
            key={other}
            href={LEGAL_PATHS[other]}
            current={other === kind}
            className="font-bold"
          >
            {legalTitle(everything, other)}
          </Link>
        ))}
      </nav>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-24 lg:w-1/4 lg:shrink-0">
          <details
            open={contentsOpen}
            className="rounded-lg border border-line bg-surface p-4 lg:hidden"
          >
            <summary className="cursor-pointer font-bold">{translate("contents")}</summary>
            <div className="mt-3">{contentsList}</div>
          </details>
          <nav aria-label={translate("contents")} className="hidden lg:block">
            <Text variant="overline" tone="muted" className="mb-3">
              {translate("contents")}
            </Text>
            {contentsList}
          </nav>
        </aside>

        <article className="min-w-0 flex-1">
          <Text as="span" variant="overline" tone="accent">
            {translate("tag")}
          </Text>
          <Heading as={titleAs} size="1" id={titleId} tabIndex={-1} className="mt-1">
            {title}
          </Heading>
          {updated ? (
            <Text variant="caption" tone="muted" className="mt-2">
              {updated}
              {version ? " · " : null}
              {version}
            </Text>
          ) : null}
          {document.draft ? (
            <Alert tone="warning" title={translate("draft.title")} className="mt-6">
              {translate("draft.body")}
            </Alert>
          ) : null}
          <Text variant="lead" className="mt-6 mb-8">
            {document.summary}
          </Text>
          {document.sections.map((section, index) => {
            const headingId = titleId + "-" + section.id;
            return (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={headingId}
                className="mb-8 scroll-mt-24"
              >
                <Heading as="h2" size="3" id={headingId} className="mb-3">
                  {index + 1}. {section.heading}
                </Heading>
                {section.blocks.map((block, blockIndex) => (
                  <Block key={section.id + "-" + blockIndex} block={block} />
                ))}
              </section>
            );
          })}
        </article>
      </div>
    </Container>
  );
}
