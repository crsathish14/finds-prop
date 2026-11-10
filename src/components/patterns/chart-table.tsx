/**
 * ChartTable: the same numbers as a line chart, as a table.
 * Purpose: the "Table" view of every chart (S7-T06, FR-ADM-01): a chart is never the only way to read its numbers, for
 *   a screen reader, for someone who wants the exact value, and for someone who cannot tell the colours apart. Owner:
 *   design system. It holds no state.
 * Props: caption (names the table for a screen reader), xName (the heading of the first column, "Date"), labels (one row
 *   for each), series ({ id, name, data }[], one column each), unit (a suffix), locale, className.
 * Responsive: a tall table scrolls inside its own box (about 280 px high), with the headings kept at the top, so the
 *   page does not grow with the number of days; a wide one scrolls sideways.
 * Accessibility: the scrolling box is a focusable named region (so the keyboard can scroll it); a real table with a caption; each row starts with a row heading (the day), each column has a heading.
 * States: one or several series, many rows (scrolls), a unit.
 * Dependencies: lib/chart-scale, cn. Tests: line-chart.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, the Table view of "Leads, enquiries and shortlists".
 */
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/chart-scale";

type ChartTableProps = {
  caption: string;
  xName: string;
  labels: string[];
  series: { id: string; name: string; data: number[] }[];
  unit?: string;
  locale?: string;
  className?: string;
};

function ChartTable({
  caption,
  xName,
  labels,
  series,
  unit = "",
  locale = "en",
  className,
}: ChartTableProps) {
  return (
    <div
      data-slot="chart-table"
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn("max-h-70 overflow-auto rounded-md border border-line", className)}
    >
      <table className="w-full border-collapse text-small">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            <th
              scope="col"
              className="border-b border-line px-3 py-2 text-start font-semibold text-muted"
            >
              {xName}
            </th>
            {series.map((entry) => (
              <th
                key={entry.id}
                scope="col"
                className="border-b border-line px-3 py-2 text-end font-semibold text-muted"
              >
                {entry.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={`${index}-${label}`} className="border-b border-line last:border-b-0">
              <th scope="row" className="px-3 py-2 text-start font-medium text-ink">
                {label}
              </th>
              {series.map((entry) => (
                <td
                  key={entry.id}
                  className="px-3 py-2 text-end font-semibold text-ink tabular-nums"
                >
                  {formatCount(locale, entry.data[index] ?? 0)}
                  {unit}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ChartTable };
export type { ChartTableProps };
