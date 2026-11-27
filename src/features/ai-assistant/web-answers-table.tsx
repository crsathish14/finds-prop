import { ResponsiveTable } from "@/components/patterns/responsive-table";
import { Heading } from "@/components/ui/heading";
import { formatDate, type Translate } from "@/lib/format";
import type { WebAnswerRow } from "./queries";

export type WebAnswersTableProps = {
  rows: readonly WebAnswerRow[];
  translate: Translate;
  locale: string;
};

/**
 * The questions most often answered from the web (ADR-218, piece 7): the search words the assistant wrote (never a
 * visitor's message), how often each answer was used and when last, most used first, at most 50. The admin adds the
 * common ones to the FAQ or the articles so the assistant answers them from findsprop, for free.
 */
export function WebAnswersTable({ rows, translate, locale }: WebAnswersTableProps) {
  const title = translate("admin.aiAssistant.answers.title");
  return (
    <section className="flex flex-col gap-4">
      <Heading as="h2" size="3">
        {title}
      </Heading>
      {rows.length === 0 ? (
        <p className="text-body text-muted">{translate("admin.aiAssistant.answers.empty")}</p>
      ) : (
        <ResponsiveTable
          caption={title}
          columns={[
            { id: "query", heading: translate("admin.aiAssistant.answers.query"), role: "main" },
            {
              id: "timesUsed",
              heading: translate("admin.aiAssistant.answers.timesUsed"),
              align: "end",
              width: 18,
              nowrap: true,
            },
            {
              id: "lastUsed",
              heading: translate("admin.aiAssistant.answers.lastUsed"),
              width: 22,
              nowrap: true,
            },
          ]}
          rows={rows.map((row, index) => ({
            id: `${index}-${row.query}`,
            cells: {
              query: <span className="text-body text-ink">{row.query}</span>,
              timesUsed: row.timesUsed,
              lastUsed: formatDate(locale, row.lastUsedAt),
            },
          }))}
        />
      )}
    </section>
  );
}
