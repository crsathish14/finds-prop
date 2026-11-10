import type { LabEntry } from "../types";
import {
  ChartCardDemo,
  LineChartDemo,
  OverviewPageDemo,
  RecentLeadsDemo,
  ShareAndBarsDemo,
} from "./charts-demos";

/**
 * The charts of the admin's Overview page (S7-T06, FR-ADM-01): the line chart with its crosshair and tooltip, the
 * frame with its Chart / Table switch, the part-to-whole bar, the horizontal bars, the recent leads, and the whole
 * page with its error and reloading states. It has its own board because the Admin board had grown too tall to
 * photograph within the time limit at 820 and 1440 px (as the Site content, Sponsors, Forms and CRM boards did). It
 * mirrors the admin Overview screen.
 */
export const CHARTS: LabEntry[] = [
  {
    id: "chart-line",
    name: "Line chart",
    description:
      "One to four series over a run of days, drawn as SVG: 2 px lines, a ringed dot and the last number at each end, a quiet grid, a legend for two or more series, and a crosshair with one tooltip that lists every series (a pointer, or the arrow keys, Home and End). Each series keeps its own colour. Shown with three series and the crosshair, at rest, with one series, with two that end together, at phone width and with no activity.",
    sources: ["patterns/line-chart.tsx"],
    Demo: LineChartDemo,
  },
  {
    id: "chart-card",
    name: "Chart card and table view",
    description:
      "The frame round a chart: its title, what it counts, the Chart / Table switch and the chart. The table view has the same numbers in a box that scrolls with its headings kept at the top, so a chart is never the only way to read its numbers. Shown with the chart, with the table and with nothing to show.",
    sources: ["patterns/chart-card.tsx", "patterns/chart-table.tsx"],
    Demo: ChartCardDemo,
  },
  {
    id: "chart-share-bars",
    name: "Share bar and bar list",
    description:
      "A whole split into a few parts as one stacked bar with a 2 px gap between the parts and a table of names, numbers and shares under it (a fifth part and more are added together as Other); and one number for each of a few named things as horizontal bars in one colour, biggest first. Shown with three and six parts, six rows, and a very long name with a large number.",
    sources: ["patterns/share-bar.tsx", "patterns/bar-list.tsx"],
    Demo: ShareAndBarsDemo,
  },
  {
    id: "chart-recent-leads",
    name: "Recent leads",
    description:
      "The newest few people who got in touch, one line each: an avatar with their initials, their name, what they asked about and how long ago. Shown with five lines and the link to every lead, with very long names, and with nothing yet.",
    sources: ["domain/recent-leads.tsx"],
    Demo: RecentLeadsDemo,
  },
  {
    id: "overview-page",
    name: "Admin overview",
    description:
      "The whole Overview page put together from these parts and the Insights panel: the numbers in three groups (Listings, People, Leads and engagement), the date choice with Today and Yesterday, the three charts and the recent leads. Shown normally, and with the error notice and Try again while it reloads (an Updating line; the text is not dimmed).",
    sources: ["domain/insights-panel.tsx"],
    Demo: OverviewPageDemo,
  },
];
