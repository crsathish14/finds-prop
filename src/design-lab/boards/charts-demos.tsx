"use client";

import {
  CircleCheck,
  Clock,
  Heart,
  Inbox,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
  UserRound,
  Briefcase,
  Tag,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  InsightsPanel,
  type InsightsGroup,
  type InsightsTile,
} from "@/components/domain/insights-panel";
import { RecentLeads, type RecentLead } from "@/components/domain/recent-leads";
import { Alert } from "@/components/patterns/alert";
import { BarList } from "@/components/patterns/bar-list";
import { ChartCard } from "@/components/patterns/chart-card";
import { ChartTable } from "@/components/patterns/chart-table";
import { LineChart, type LineChartSeries } from "@/components/patterns/line-chart";
import { ShareBar } from "@/components/patterns/share-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { Specimen, Stage } from "../frame";

/**
 * The charts of the admin's Overview page (S7-T06, FR-ADM-01) in their states: the line chart with its crosshair, the
 * Chart / Table card, the part-to-whole bar, the horizontal bars and the recent leads, and then the whole page with
 * its error and refetch states. Plain English text and made-up numbers (a wave, so every picture is the same);
 * nothing here goes anywhere. The words come from the approved admin-overview screen; the few that do not are listed
 * in ADR-120 for the owner to confirm.
 */

const DAYS = Array.from({ length: 30 }, (_unused, index) => `${index + 1} Oct`);
const DETAIL_DAYS = Array.from({ length: 30 }, (_unused, index) => `${index + 1} Oct 2026`);

/** A smooth, repeatable run of counts: a base, a swing, a phase and a drift upwards. */
const wave = (base: number, swing: number, phase: number, drift: number) =>
  DAYS.map((_label, index) =>
    Math.round(base + swing * Math.sin(index / 3.2 + phase) + (drift * index) / 29),
  );

const SHORTLISTS: LineChartSeries = {
  id: "shortlists",
  name: "Shortlists",
  slot: 1,
  data: wave(52, 12, 2.1, 24),
};
const LEADS: LineChartSeries = { id: "leads", name: "Leads", slot: 2, data: wave(24, 6, 0, 8) };
const ENQUIRIES: LineChartSeries = {
  id: "enquiries",
  name: "Enquiries",
  slot: 3,
  data: wave(13, 4, 1.2, 3),
};
const THREE = [SHORTLISTS, LEADS, ENQUIRIES];

const TITLE = "Leads, enquiries and shortlists per day";

/* ── Line chart ───────────────────────────────────────────────────── */

export function LineChartDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Three series with the crosshair on 18 Oct: one tooltip lists every series (move the pointer, or focus the chart and use the arrow keys)"
        className="w-full"
      >
        <Stage className="w-full">
          <LineChart
            title={TITLE}
            labels={DAYS}
            detailLabels={DETAIL_DAYS}
            series={THREE}
            defaultPoint={17}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="At rest: each series named at its end with its last number, and a legend"
        className="w-full"
      >
        <Stage className="w-full">
          <LineChart title={TITLE} labels={DAYS} detailLabels={DETAIL_DAYS} series={THREE} />
        </Stage>
      </Specimen>
      <Specimen label="One series: no legend, because the title names it" className="w-full">
        <Stage className="w-full">
          <LineChart
            title="Leads per day"
            labels={DAYS}
            detailLabels={DETAIL_DAYS}
            series={[LEADS]}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="Two series that finish on the same number: the end names are moved apart"
        className="w-full"
      >
        <Stage className="w-full">
          <LineChart
            title="Leads and enquiries per day"
            labels={DAYS.slice(0, 7)}
            series={[
              { id: "leads", name: "Leads", slot: 2, data: [4, 6, 5, 8, 7, 9, 9] },
              { id: "enquiries", name: "Enquiries", slot: 3, data: [2, 3, 5, 6, 8, 9, 9] },
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="On a phone: no end names and fewer day labels (the legend still names every series)"
        className="w-full"
      >
        <Stage className="w-full max-w-sm">
          <LineChart
            title={TITLE}
            labels={DAYS}
            detailLabels={DETAIL_DAYS}
            series={THREE}
            defaultPoint={24}
          />
        </Stage>
      </Specimen>
      <Specimen label="A quiet range: every day is 0, so the scale is 0 and 1" className="w-full">
        <Stage className="w-full">
          <LineChart
            title="Leads per day"
            labels={DAYS.slice(0, 5)}
            series={[{ id: "leads", name: "Leads", slot: 2, data: [0, 0, 0, 0, 0] }]}
          />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── Chart card and table ─────────────────────────────────────────── */

const CARD_WORDS = { views: "Chart view", chart: "Chart", table: "Table" };

function Table({ rows }: { rows?: number }) {
  return (
    <ChartTable
      caption={TITLE}
      xName="Date"
      labels={DAYS.slice(0, rows ?? 30)}
      series={THREE.map((entry) => ({ ...entry, data: entry.data.slice(0, rows ?? 30) }))}
    />
  );
}

export function ChartCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="A chart with the Chart / Table switch (press Table)" className="w-full">
        <Stage tone="canvas" className="w-full">
          <ChartCard
            title="Leads, enquiries and shortlists"
            description="Per day, 1 to 30 Oct"
            table={<Table />}
            words={CARD_WORDS}
          >
            <LineChart title={TITLE} labels={DAYS} detailLabels={DETAIL_DAYS} series={THREE} />
          </ChartCard>
        </Stage>
      </Specimen>
      <Specimen
        label="The Table view: a box that scrolls, with its headings kept at the top"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <ChartCard
            title="Leads, enquiries and shortlists"
            description="Per day, 1 to 30 Oct"
            table={<Table />}
            words={CARD_WORDS}
            defaultView="table"
          >
            <LineChart title={TITLE} labels={DAYS} series={THREE} />
          </ChartCard>
        </Stage>
      </Specimen>
      <Specimen label="Nothing to show in the range" className="w-full">
        <Stage tone="canvas" className="w-full">
          <ChartCard
            title="Leads, enquiries and shortlists"
            description="Per day, 1 to 30 Oct"
            table={<Table rows={3} />}
            words={CARD_WORDS}
            empty={{ title: "No activity in this range", text: "Try a longer date range." }}
          >
            <LineChart title={TITLE} labels={DAYS} series={THREE} />
          </ChartCard>
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── Share bar and bar list ───────────────────────────────────────── */

const SOURCES = [
  { id: "projects", name: "Project pages", value: 412 },
  { id: "enquiries", name: "Property enquiries", value: 268 },
  { id: "forms", name: "Other forms", value: 126 },
];

const PROJECTS = [
  { id: "kadal-vista", label: "Kadal Vista", value: 128 },
  { id: "arivu", label: "Arivu Heights", value: 96 },
  { id: "nila", label: "Nila Grove", value: 74 },
  { id: "thendral", label: "Thendral Residency", value: 51 },
  { id: "courts", label: "Kadal Courts", value: 38 },
  { id: "meadows", label: "Nila Meadows", value: 21 },
];

export function ShareAndBarsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-6 md:grid-cols-2">
        <Specimen label="Leads by source: three parts, as one bar with a 2 px gap and a table">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Leads by source" description="Share of 806 leads" headingLevel={3}>
              <ShareBar title="Leads by source" parts={SOURCES} />
            </ChartCard>
          </Stage>
        </Specimen>
        <Specimen label="Six parts: the first four keep their colours and the rest are added together as Other">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Leads by source" description="Share of 862 leads" headingLevel={3}>
              <ShareBar
                title="Leads by source"
                parts={[
                  ...SOURCES,
                  { id: "ai", name: "AI search", value: 56 },
                  { id: "ads", name: "Ads", value: 40 },
                  { id: "partners", name: "Partners", value: 12 },
                ]}
              />
            </ChartCard>
          </Stage>
        </Specimen>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Specimen label="Enquiries by project: six rows, biggest first">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Enquiries by project" description="Top 6 projects" headingLevel={3}>
              <BarList title="Enquiries by project" rows={PROJECTS} />
            </ChartCard>
          </Stage>
        </Specimen>
        <Specimen label="One row, a very long name (cut, with its full name as the tooltip) and a large number">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Enquiries by project" description="Top 1 project" headingLevel={3}>
              <BarList
                title="Enquiries by project"
                rows={[
                  {
                    id: "long",
                    label: "Thendral Residency, the second phase beside the lake",
                    value: 128400,
                  },
                  { id: "short", label: "Nila", value: 9 },
                ]}
              />
            </ChartCard>
          </Stage>
        </Specimen>
      </div>
    </div>
  );
}

/* ── Recent leads ─────────────────────────────────────────────────── */

const RECENT: RecentLead[] = [
  {
    id: "1",
    name: "Arjun Menon",
    initials: "AM",
    meta: "Kadal Vista · Enquiry",
    when: "12 min ago",
  },
  {
    id: "2",
    name: "Divya Krishnan",
    initials: "DK",
    meta: "Arivu Heights · Site visit",
    when: "1 hr ago",
    tone: "copper",
  },
  {
    id: "3",
    name: "Karthik S",
    initials: "KS",
    meta: "Contact page · Message",
    when: "2 hr ago",
  },
  {
    id: "4",
    name: "Revathi P",
    initials: "RP",
    meta: "Nila Grove · Brochure",
    when: "3 hr ago",
    tone: "copper",
  },
  {
    id: "5",
    name: "Suresh N",
    initials: "SN",
    meta: "Kadal Courts · Enquiry",
    when: "5 hr ago",
  },
];

const ALL_LEADS = (
  <Link href="#" variant="nav">
    All leads
  </Link>
);

export function RecentLeadsDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen label="Five lines, with the link to every lead">
        <Stage tone="canvas" className="w-full">
          <ChartCard title="Recent leads" action={ALL_LEADS} headingLevel={3}>
            <RecentLeads
              leads={RECENT}
              label="Recent leads"
              empty={{ title: "No leads yet", text: "New leads will show here." }}
            />
          </ChartCard>
        </Stage>
      </Specimen>
      <div className="flex flex-col gap-6">
        <Specimen label="Long names and lines are cut, and the time stays in its place">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Recent leads" action={ALL_LEADS} headingLevel={3}>
              <RecentLeads
                leads={[
                  {
                    id: "long",
                    name: "Lakshmi Narayanan Venkataraghavan Iyengar",
                    initials: "LN",
                    meta: "Thendral Residency, the second phase beside the lake · Site visit",
                    when: "Yesterday",
                  },
                ]}
                label="Recent leads"
                empty={{ title: "No leads yet", text: "New leads will show here." }}
              />
            </ChartCard>
          </Stage>
        </Specimen>
        <Specimen label="Nothing yet">
          <Stage tone="canvas" className="w-full">
            <ChartCard title="Recent leads" action={ALL_LEADS} headingLevel={3}>
              <RecentLeads
                leads={[]}
                label="Recent leads"
                empty={{ title: "No leads yet", text: "New leads will show here." }}
              />
            </ChartCard>
          </Stage>
        </Specimen>
      </div>
    </div>
  );
}

/* ── The whole Overview page ──────────────────────────────────────── */

const tile = (
  id: string,
  label: string,
  value: string,
  icon: LucideIcon,
  extra: Partial<InsightsTile> = {},
): InsightsTile => ({ id, label, value, icon: <Icon icon={icon} size="sm" />, ...extra });

const LISTINGS: InsightsGroup = {
  id: "listings",
  label: "Listings",
  tiles: [
    tile("total", "Total properties", "248", Tag),
    tile("active", "Active (approved)", "196", CircleCheck),
    tile("waiting", "Awaiting approval", "14", Clock, {
      iconTone: "warning",
      note: "Review listings",
    }),
  ],
};
const PEOPLE: InsightsGroup = {
  id: "people",
  label: "People",
  tiles: [
    tile("customers", "Customers", "1,284", Users),
    tile("agents", "Agents", "7", UserRound, { note: "Role only, no agent portal yet" }),
    tile("builders", "Builders", "12", Briefcase),
  ],
};
const ENGAGEMENT: InsightsGroup = {
  id: "engagement",
  label: "Leads and engagement",
  tiles: [
    tile("leads", "Total leads", "862", Inbox, { iconTone: "copper" }),
    tile("today", "New leads today", "23", Bell, { iconTone: "copper" }),
    tile("enquiries", "Enquiries", "417", MessageSquare, { iconTone: "info" }),
    tile("shortlisted", "Shortlisted", "1,930", Heart),
    tile("conversion", "Conversion", "6.4%", TrendingUp, { note: "Definition to confirm" }),
  ],
};
const GROUPS = [LISTINGS, PEOPLE, ENGAGEMENT];

const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

function Overview({
  failed = false,
  refetching = false,
}: {
  failed?: boolean;
  refetching?: boolean;
}) {
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState("2026-10-12");
  const [to, setTo] = useState("2026-10-28");
  return (
    <InsightsPanel
      headingLevel="h2"
      title="Overview"
      intro="Activity across listings, people and leads."
      range={{ label: "Date range", options: RANGES, value: range, onChange: setRange }}
      customRange={{
        fromLabel: "From",
        toLabel: "To",
        from,
        to,
        onFromChange: setFrom,
        onToChange: setTo,
      }}
      {...(failed
        ? {
            notice: (
              <Alert
                tone="danger"
                title="We couldn't load the overview"
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    iconStart={<Icon icon={RefreshCw} size="sm" />}
                  >
                    Try again
                  </Button>
                }
              >
                Check your connection and try again. The numbers below are from the last successful
                load.
              </Alert>
            ),
          }
        : {})}
      groups={GROUPS}
    >
      <div
        aria-busy={refetching}
        className={cn(
          "flex flex-col gap-4 transition-opacity",
          refetching && "pointer-events-none opacity-60",
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Leads, enquiries and shortlists"
            description="Per day, 1 to 30 Oct"
            table={<Table />}
            words={CARD_WORDS}
          >
            <LineChart title={TITLE} labels={DAYS} detailLabels={DETAIL_DAYS} series={THREE} />
          </ChartCard>
          <ChartCard title="Leads by source" description="Share of 806 leads">
            <ShareBar title="Leads by source" parts={SOURCES} />
          </ChartCard>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Enquiries by project" description="Top 6 projects">
            <BarList title="Enquiries by project" rows={PROJECTS} />
          </ChartCard>
          <ChartCard title="Recent leads" action={ALL_LEADS}>
            <RecentLeads
              leads={RECENT}
              label="Recent leads"
              empty={{ title: "No leads yet", text: "New leads will show here." }}
            />
          </ChartCard>
        </div>
      </div>
    </InsightsPanel>
  );
}

export function OverviewPageDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The Overview page: the numbers in three groups, the date choice (Custom shows two dates), the charts and the recent leads"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Overview />
        </Stage>
      </Specimen>
      <Specimen
        label="The overview could not load: the last numbers stay with a way to try again, and the charts are dimmed while it reloads"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Overview failed refetching />
        </Stage>
      </Specimen>
    </div>
  );
}
