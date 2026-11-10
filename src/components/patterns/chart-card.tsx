"use client";

/**
 * ChartCard: the frame round a chart: its title, what it counts, an optional Chart / Table switch and the chart.
 * Purpose: every chart on the admin overview (S7-T06, FR-ADM-01) sits in one, so the headings, the switch and the empty
 *   state are the same everywhere. Owner: design system. It holds only which view is shown (the chart or its table).
 * Props: title, description (a line under it, "Per day, 1 to 30 Oct"), headingLevel (2 default | 3), action (something
 *   at the end of the heading line, such as a link, after the switch when there is one), children (the chart), table (the chart's numbers as a table; when
 *   given, the Chart / Table switch is shown), words ({ views: names the switch, chart, table }, needed with `table`),
 *   defaultView ("chart" default | "table", which view it starts on), empty ({ title, text }; when given it is shown instead of the chart and the switch), className.
 * Responsive: the heading and the switch sit on one line from 480 px and wrap under each other below that.
 * Accessibility: the card is a section named by its heading; the switch is a radio group named by `words.views` and
 *   the arrow keys move between its two options; the empty state is plain text under the heading.
 * States: a chart, its table, nothing to show (empty), with and without an action or a switch.
 * Dependencies: SegmentedControl, Heading, Text, cn. Tests: line-chart.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, chart-card (ch, seg, empty).
 */
import { useId, useState, type ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type ChartCardProps = {
  title: string;
  description?: string;
  headingLevel?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
  table?: ReactNode;
  words?: { views: string; chart: string; table: string };
  defaultView?: "chart" | "table";
  empty?: { title: string; text: string } | undefined;
  className?: string;
};

function ChartCard({
  title,
  description,
  headingLevel = 2,
  action,
  children,
  table,
  words,
  defaultView = "chart",
  empty,
  className,
}: ChartCardProps) {
  const headingId = useId();
  const [view, setView] = useState<"chart" | "table">(defaultView);
  const switchable = table !== undefined && words !== undefined && !empty;
  return (
    <section
      data-slot="chart-card"
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-4 md:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading as={headingLevel === 2 ? "h2" : "h3"} size="3" id={headingId}>
            {title}
          </Heading>
          {description ? (
            <Text tone="muted" variant="caption">
              {description}
            </Text>
          ) : null}
        </div>
        {switchable ? (
          <SegmentedControl
            size="sm"
            aria-label={words.views}
            value={view}
            onValueChange={(next) => setView(next === "table" ? "table" : "chart")}
            options={[
              { value: "chart", label: words.chart },
              { value: "table", label: words.table },
            ]}
          />
        ) : null}
        {action}
      </div>
      {empty ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <p className="text-body font-semibold text-ink">{empty.title}</p>
          <p className="text-small text-muted">{empty.text}</p>
        </div>
      ) : switchable && view === "table" ? (
        table
      ) : (
        children
      )}
    </section>
  );
}

export { ChartCard };
export type { ChartCardProps };
