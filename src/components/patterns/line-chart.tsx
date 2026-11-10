"use client";

/**
 * LineChart: one to four series over a run of days (or any ordered labels), drawn as SVG.
 * Purpose: the admin overview's "Leads, enquiries and shortlists per day" (S7-T06, FR-ADM-01), and any later chart of
 *   counts over time. Hand-built rather than a chart library (ADR-120): the design asks for exactly this chart and
 *   a library would have to be fought into it. Owner: design system. It holds only what the pointer and keyboard do
 *   (which point the crosshair is on) and the width it is drawn at; the page passes the numbers.
 * Props: title (names the chart for a screen reader), labels (the x axis, in order: "1 Oct"), series ({ id, name,
 *   slot 1 to 4, data }[], one number per label; the slot is the series' colour and follows the entity, never its
 *   rank), defaultPoint (the point the crosshair starts on, for the Design Lab and tests; none by default), detailLabels (a longer name for each point, shown above the tooltip; the labels by default), unit (a
 *   suffix such as "%"), locale (numbers are written in it), height (at most, in px; 300 by default), className.
 * Responsive: it is drawn at the width it is given (text stays 12 px at every width), and redrawn when that changes.
 *   From 480 px each series is named at its end; below that the end names go and fewer day labels are shown.
 * Accessibility: the chart is one focusable picture with a name; the left and right arrow keys, Home and End move a
 *   crosshair, and a polite line says the day and every series' number, so nothing depends on a pointer. A legend names
 *   every series when there are two or more (colour is never the only signal). The table twin is `ChartTable`.
 * States: one series (no legend), several series, the crosshair on a point (a pointer or the keys), an end label that
 *   would print over another (moved apart), a single day, all zeros.
 * Dependencies: lib/chart-scale, cn. Tests: line-chart.test.tsx; Design Lab "Charts" (S7-T06).
 * UX reference: admin-overview screen, "Leads, enquiries and shortlists" (chart, crosshair, tt, legend).
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import {
  formatCount,
  labelEvery,
  niceTicks,
  seriesColor,
  seriesStyle,
  spreadLabels,
  type SeriesSlot,
} from "@/lib/chart-scale";

type LineChartSeries = { id: string; name: string; slot: SeriesSlot; data: number[] };

type LineChartProps = {
  title: string;
  labels: string[];
  series: LineChartSeries[];
  detailLabels?: string[];
  defaultPoint?: number;
  unit?: string;
  locale?: string;
  height?: number;
  className?: string;
};

const MARGIN_LEFT = 44;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 30;
const END_LABEL_ROOM = 104;
const WIDE = 480;
/** The width used before the chart has been measured (and where nothing can be measured). */
const FIRST_WIDTH = 640;

function LineChart({
  title,
  labels,
  series,
  detailLabels,
  defaultPoint,
  unit = "",
  locale = "en",
  height = 300,
  className,
}: LineChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(FIRST_WIDTH);
  const [point, setPoint] = useState<number | null>(defaultPoint ?? null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const measured = Math.round(host.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const count = labels.length;
  if (count === 0 || series.length === 0) return null;

  const wide = width >= WIDE;
  const marginRight = wide ? END_LABEL_ROOM : 16;
  const chartHeight = Math.round(Math.min(height, Math.max(190, width * 0.42)));
  const plotWidth = width - MARGIN_LEFT - marginRight;
  const plotHeight = chartHeight - MARGIN_TOP - MARGIN_BOTTOM;
  const ticks = niceTicks(Math.max(0, ...series.flatMap((entry) => entry.data)));
  const top = ticks.at(-1) ?? 1;
  const xOf = (index: number) =>
    MARGIN_LEFT + (count === 1 ? plotWidth / 2 : (index * plotWidth) / (count - 1));
  const yOf = (value: number) => MARGIN_TOP + plotHeight - (value / top) * plotHeight;
  const every = labelEvery(count, wide ? 6 : 4);
  const number = (value: number) => `${formatCount(locale, value)}${unit}`;
  const detail = (index: number) => detailLabels?.[index] ?? labels[index] ?? "";
  const endPlaces = spreadLabels(
    series.map((entry) => yOf(entry.data.at(-1) ?? 0)),
    16,
  );

  const nearest = (clientX: number): number => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || count === 1) return 0;
    const across = ((clientX - box.left) / box.width) * width;
    const index = Math.round(((across - MARGIN_LEFT) / plotWidth) * (count - 1));
    return Math.min(count - 1, Math.max(0, index));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const from = point ?? count - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, from - 1),
      ArrowRight: Math.min(count - 1, from + 1),
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setPoint(next);
    } else if (event.key === "Escape") {
      setPoint(null);
    }
  };

  const spoken =
    point === null
      ? ""
      : `${detail(point)}: ${series
          .map((entry) => `${entry.name} ${number(entry.data[point] ?? 0)}`)
          .join(", ")}`;

  // The tooltip sits to the right of the crosshair, and to its left once the crosshair is past the middle.
  const tooltipLeft = point === null ? 0 : xOf(point);
  const flip = point !== null && tooltipLeft > width * 0.55;

  return (
    <div data-slot="line-chart" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div ref={hostRef} className="relative w-full min-w-0">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${chartHeight}`}
          role="img"
          aria-label={title}
          tabIndex={0}
          className="block h-auto w-full overflow-visible text-caption focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          onPointerMove={(event: PointerEvent<SVGSVGElement>) => setPoint(nearest(event.clientX))}
          onPointerLeave={() => setPoint(null)}
          onKeyDown={onKeyDown}
          onFocus={() => setPoint((current) => current ?? count - 1)}
          onBlur={() => setPoint(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN_LEFT}
                x2={width - marginRight}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className="stroke-line"
              />
              <text x={MARGIN_LEFT - 10} y={yOf(tick) + 4} textAnchor="end" className="fill-muted">
                {formatCount(locale, tick)}
              </text>
            </g>
          ))}
          <line
            x1={MARGIN_LEFT}
            x2={width - marginRight}
            y1={yOf(0)}
            y2={yOf(0)}
            className="stroke-line-strong"
          />
          {labels.map((label, index) =>
            index % every === 0 ? (
              <text
                key={`${index}-${label}`}
                x={xOf(index)}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-muted"
              >
                {label}
              </text>
            ) : null,
          )}
          {series.map((entry, order) => {
            const colour = seriesColor(entry.slot);
            const path = entry.data
              .map(
                (value, index) =>
                  `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)} ${yOf(value).toFixed(1)}`,
              )
              .join("");
            const lastX = xOf(count - 1);
            const lastY = yOf(entry.data.at(-1) ?? 0);
            return (
              <g key={entry.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={colour}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={lastX} cy={lastY} r={6} className="fill-surface" />
                <circle cx={lastX} cy={lastY} r={4} fill={colour} />
                {wide ? (
                  <text x={lastX + 14} y={(endPlaces[order] ?? lastY) + 4} className="fill-muted">
                    <tspan className="fill-ink font-bold">{number(entry.data.at(-1) ?? 0)}</tspan>
                    <tspan dx={5}>{entry.name}</tspan>
                  </text>
                ) : null}
              </g>
            );
          })}
          {point !== null ? (
            <g aria-hidden="true">
              <line
                x1={xOf(point)}
                x2={xOf(point)}
                y1={MARGIN_TOP}
                y2={MARGIN_TOP + plotHeight}
                className="stroke-line-input"
              />
              {series.map((entry) => (
                <g key={entry.id}>
                  <circle
                    cx={xOf(point)}
                    cy={yOf(entry.data[point] ?? 0)}
                    r={6}
                    className="fill-surface"
                  />
                  <circle
                    cx={xOf(point)}
                    cy={yOf(entry.data[point] ?? 0)}
                    r={4}
                    fill={seriesColor(entry.slot)}
                  />
                </g>
              ))}
            </g>
          ) : null}
        </svg>
        {point !== null ? (
          <div
            aria-hidden="true"
            data-slot="line-chart-tooltip"
            className="pointer-events-none absolute top-2 z-10 min-w-37.5 rounded-lg border border-line-strong bg-surface px-3 py-3 shadow-(--shadow-pop)"
            style={
              flip
                ? { left: tooltipLeft - 14, transform: "translateX(-100%)" }
                : { left: tooltipLeft + 14 }
            }
          >
            <p className="mb-2 text-caption font-semibold text-muted">{detail(point)}</p>
            {series.map((entry) => (
              <p key={entry.id} className="flex items-center gap-2 text-small text-muted">
                <i
                  className="h-0.75 w-3.5 flex-none rounded-sm bg-(--series)"
                  style={seriesStyle(entry.slot)}
                />
                <b className="min-w-8.5 font-bold text-ink tabular-nums">
                  {number(entry.data[point] ?? 0)}
                </b>
                <span>{entry.name}</span>
              </p>
            ))}
          </div>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {spoken}
        </span>
      </div>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-small font-semibold text-ink">
          {series.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <i
                aria-hidden="true"
                className="h-0.75 w-4.5 rounded-sm bg-(--series)"
                style={seriesStyle(entry.slot)}
              />
              {entry.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { LineChart };
export type { LineChartProps, LineChartSeries };
