/**
 * BarList: one number for each of a few named things, as horizontal bars, biggest first.
 * Purpose: the admin overview's "Enquiries by project" (S7-T06, FR-ADM-01): a single value for each category is drawn
 *   as horizontal bars (never as a line, and never in several colours, because the categories have no order of
 *   colour). Owner: design system. It holds no state.
 * Props: title (names the list for a screen reader), rows ({ id, label, value }[], already in the order wanted),
 *   locale, className.
 * Responsive: the label column is 96 to 168 px and the bar takes the rest of the row; a long label is cut with an
 *   ellipsis and its full text is the row's tooltip.
 * Accessibility: a list named by `title`; every row says its label and its number in text next to the bar, so the bar
 *   adds nothing a screen reader would miss and colour carries nothing.
 * States: a few rows, one row, a long label, all rows equal, no value above 0 (the bars are flat).
 * Dependencies: lib/chart-scale, cn. Tests: share-bar-and-list.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, "Enquiries by project" (hbars, hb).
 */
import { cn } from "@/lib/cn";
import { formatCount, seriesStyle } from "@/lib/chart-scale";

type BarListRow = { id: string; label: string; value: number };

type BarListProps = {
  title: string;
  rows: BarListRow[];
  locale?: string;
  className?: string;
};

function BarList({ title, rows, locale = "en", className }: BarListProps) {
  if (rows.length === 0) return null;
  const biggest = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul data-slot="bar-list" aria-label={title} className={cn("grid min-w-0 gap-4", className)}>
      {rows.map((row) => (
        <li
          key={row.id}
          title={`${row.label}: ${formatCount(locale, row.value)}`}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-3 text-small font-semibold text-ink"
        >
          <span className="truncate">{row.label}</span>
          <span className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 flex-1">
              <i
                aria-hidden="true"
                className="block h-4.5 min-w-0.5 rounded-e bg-(--series)"
                style={{ ...seriesStyle(1), width: `${(row.value / biggest) * 100}%` }}
              />
            </span>
            <b className="min-w-10 text-end font-bold tabular-nums">
              {formatCount(locale, row.value)}
            </b>
          </span>
        </li>
      ))}
    </ul>
  );
}

export { BarList };
export type { BarListProps, BarListRow };
