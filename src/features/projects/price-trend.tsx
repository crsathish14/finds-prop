import { useLocale, useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/cn";
import { formatMonth, formatPrice, type Translate } from "@/lib/format";
import type { TrendPoint } from "./types";
import { trendFraction, trendLabelIndexes, trendScale } from "./view";

const PERCENT = 100;

/**
 * The developer's price per square foot over the latest months (UX: "Price per sq.ft, last 8 months"),
 * as a line with the area under it, the values down the left and the month names under it, and a
 * "View as table" with every month and value for anyone who prefers numbers (or cannot see the line).
 * The line is the only drawing: the numbers and months are real text, so they stay a readable size on
 * a phone and a screen reader gets the table. With fewer than two months there is no trend and nothing
 * is drawn. It fetches nothing and holds no state.
 */
export function PriceTrend({
  points,
  headingId,
}: {
  points: readonly TrendPoint[];
  headingId: string;
}) {
  const translate = useTranslations("projects.page.trend");
  const words = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const scale = trendScale(points);
  const first = points[0];
  const last = points.at(-1);
  if (scale === null || first === undefined || last === undefined) return null;

  const share = (index: number) => (index / (points.length - 1)) * PERCENT;
  const rise = (value: number) => (1 - trendFraction(value, scale)) * PERCENT;
  const coordinates = points.map((point, index) => `${share(index)},${rise(point.pricePerSqft)}`);
  const line = coordinates.join(" ");
  const area = `M0,${PERCENT} L${coordinates.join(" L")} L${PERCENT},${PERCENT} Z`;
  const money = (value: number) => formatPrice(words, locale, value);
  const labelled = trendLabelIndexes(points.length);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-line bg-surface p-6"
      data-slot="price-trend"
    >
      <Heading as="h2" size="3" id={headingId}>
        {translate("title", { count: points.length })}
      </Heading>
      <p className="mt-1 text-small text-muted">{translate("sub")}</p>

      <figure
        role="img"
        aria-label={translate("chart", {
          start: money(first.pricePerSqft),
          from: formatMonth(locale, first.month),
          end: money(last.pricePerSqft),
          to: formatMonth(locale, last.month),
        })}
        className="mt-10 flex flex-col gap-3"
      >
        <div className="flex gap-3">
          <div aria-hidden="true" className="relative h-48 w-16 shrink-0">
            {scale.ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 translate-y-1/2 text-caption text-muted lining-nums"
                style={{ bottom: `${trendFraction(tick, scale) * PERCENT}%` }}
              >
                {money(tick)}
              </span>
            ))}
          </div>
          <div aria-hidden="true" className="relative h-48 min-w-0 flex-1">
            {scale.ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 border-t border-line"
                style={{ bottom: `${trendFraction(tick, scale) * PERCENT}%` }}
              />
            ))}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
            >
              <path d={area} className="fill-primary-tint" />
              <polyline
                points={line}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-primary"
              />
            </svg>
            <span
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-primary ring-2 ring-surface"
              style={{ left: `${PERCENT}%`, top: `${rise(last.pricePerSqft)}%` }}
            />
            <span
              className="absolute right-0 -translate-y-full pb-3 text-caption font-bold text-ink lining-nums"
              style={{ top: `${rise(last.pricePerSqft)}%` }}
            >
              {money(last.pricePerSqft)}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <div aria-hidden="true" className="w-16 shrink-0" />
          <div aria-hidden="true" className="relative h-6 min-w-0 flex-1">
            {labelled.map((index) => {
              const point = points[index];
              if (point === undefined) return null;
              const place =
                index === 0
                  ? ""
                  : index === points.length - 1
                    ? "-translate-x-full"
                    : "-translate-x-1/2";
              return (
                <span
                  key={point.month}
                  className={cn("absolute text-caption text-muted", place)}
                  style={{ left: `${share(index)}%` }}
                >
                  {formatMonth(locale, point.month, "short")}
                </span>
              );
            })}
          </div>
        </div>
      </figure>

      <details className="mt-4">
        <summary className="inline-block cursor-pointer rounded-xs text-small font-semibold text-primary outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary">
          {translate("viewTable")}
        </summary>
        <table aria-label={translate("tableLabel")} className="mt-3 w-full max-w-md text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 text-small font-semibold text-muted">
                {translate("month")}
              </th>
              <th scope="col" className="py-2 text-right text-small font-semibold text-muted">
                {translate("value")}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 text-body font-normal text-ink">
                  {formatMonth(locale, point.month)}
                </th>
                <td className="py-2 text-right text-body text-ink lining-nums">
                  {money(point.pricePerSqft)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
