/**
 * ShareBar: how a whole is split into a few parts: one stacked bar and a table under it.
 * Purpose: the admin overview's "Leads by source" (S7-T06, FR-ADM-01). The approved design draws a part-to-whole of
 *   four parts as one bar with a 2 px surface-coloured gap between the parts and a legend table, not a pie. Owner: design system. It
 *   holds no state: the page passes the parts and the words.
 * Props: title (names the chart for a screen reader), parts ({ id, name, value }[], in the order wanted: the first four
 *   get the four series colours in order, and a fifth part or more are added together as "Other"), otherLabel (the name
 *   of "Other"; needed only when there are more than four parts), locale, className.
 * Responsive: the bar is the full width of its box; the table under it has the name, the number and the share.
 * Accessibility: the bar is hidden from a screen reader because the table under it says the same in words; each part
 *   has a swatch, its name and its number, so colour is never the only signal. A part with no value is left out.
 * States: two to four parts, five or more (the last ones become Other), one part (the whole), no value in any part.
 * Dependencies: lib/chart-scale, cn. Tests: share-bar-and-list.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, "Leads by source" (share, sbar, stbl).
 */
import { cn } from "@/lib/cn";
import { formatCount, formatPercent, seriesStyle, type SeriesSlot } from "@/lib/chart-scale";

type SharePart = { id: string; name: string; value: number };

type ShareBarProps = {
  title: string;
  parts: SharePart[];
  otherLabel?: string;
  locale?: string;
  className?: string;
};

const NAMED_PARTS = 4;
const SLOTS: SeriesSlot[] = [1, 2, 3, 4];

/** The parts that are drawn: those with a value, the first four as they are and the rest as one "Other". */
export function shareParts(
  parts: readonly SharePart[],
  otherLabel: string,
): { part: SharePart; slot: SeriesSlot | "other" }[] {
  const present = parts.filter((part) => part.value > 0);
  const drawn: { part: SharePart; slot: SeriesSlot | "other" }[] = present
    .slice(0, NAMED_PARTS)
    .map((part, index) => ({
      part,
      slot: SLOTS[index] ?? 4,
    }));
  const rest = present.slice(NAMED_PARTS);
  if (rest.length > 0) {
    drawn.push({
      part: {
        id: "other",
        name: otherLabel,
        value: rest.reduce((sum, part) => sum + part.value, 0),
      },
      slot: "other" as const,
    });
  }
  return drawn;
}

function ShareBar({ title, parts, otherLabel = "Other", locale = "en", className }: ShareBarProps) {
  const drawn = shareParts(parts, otherLabel);
  const total = drawn.reduce((sum, entry) => sum + entry.part.value, 0);
  if (total === 0) return null;
  return (
    <div data-slot="share-bar" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div aria-hidden="true" className="flex h-5">
        {drawn.map(({ part, slot }, index) => (
          <i
            key={part.id}
            title={`${part.name}: ${formatCount(locale, part.value)}`}
            className={cn(
              "block h-full min-w-1 bg-(--series)",
              index > 0 && "border-s-2 border-surface",
              index === 0 && "rounded-s",
              index === drawn.length - 1 && "rounded-e",
            )}
            style={{ ...seriesStyle(slot), flex: part.value }}
          />
        ))}
      </div>
      <table className="w-full border-collapse text-small">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {drawn.map(({ part, slot }) => (
            <tr key={part.id} className="border-t border-line">
              <th scope="row" className="py-2 text-start font-normal text-ink">
                <span
                  aria-hidden="true"
                  className="me-3 inline-block size-3 rounded-xs bg-(--series) align-middle"
                  style={seriesStyle(slot)}
                />
                {part.name}
              </th>
              <td className="w-16 py-2 text-end font-bold text-ink tabular-nums">
                {formatCount(locale, part.value)}
              </td>
              <td className="w-16 py-2 text-end text-muted tabular-nums">
                {formatPercent(locale, part.value / total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ShareBar };
export type { ShareBarProps, SharePart };
