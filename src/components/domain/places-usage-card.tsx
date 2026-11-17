"use client";

/**
 * PlacesUsageCard: how often the site called Ola Maps, for the admin dashboard.
 * Purpose: place search is paid for by the call after a free allowance, so the admin sees our own count of
 *   calls to Ola Maps: today, this month, a line per day for 30 days, which part of the site made them, and how
 *   the calls ended (OLA_MAPS_PLAN.md section 4.6, ADR-131). Owner: design system. It holds no state and reads
 *   nothing: the page passes the counts. It shows calls only: no cost, no allowance and no credit balance (the
 *   owner's choice, 17 Nov 2026); Ola's own console has the balance and the bill.
 * Props: usage (days { label, detailLabel, calls }[] for the last 30 days oldest first, today, month, callers
 *   { id, label, calls }[], outcomes { ok, empty, timeout, quota, error }; null when no call has been made),
 *   locale ("en" default), className.
 * Responsive: three tiles in a row from 768 px and stacked below; the two lists share a row from 768 px.
 * Accessibility: each block is a section named by its heading; the line chart has its Chart / Table switch and
 *   keyboard crosshair (LineChart); the outcome counts are text next to each bar, so colour carries nothing.
 *   "Problems" is also said in words in its note, never by the tint alone.
 * States: with calls, with problems (the third tile is tinted), no calls yet (an empty state in place of the
 *   chart and lists).
 * Dependencies: ChartCard, ChartTable, LineChart, BarList, StatTile, Icon, next-intl. Tests:
 *   places-usage-card.test.tsx; Design Lab "Place search usage" (ADR-131).
 * UX reference: none yet; drawn from the admin overview's chart parts for the owner's approval (the admin
 *   overview screen, ADR-120 to ADR-122).
 */
import { Activity, CalendarDays, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { BarList } from "@/components/patterns/bar-list";
import { ChartCard } from "@/components/patterns/chart-card";
import { ChartTable } from "@/components/patterns/chart-table";
import { LineChart, type LineChartSeries } from "@/components/patterns/line-chart";
import { StatTile } from "@/components/patterns/stat-tile";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type PlacesUsageDay = { label: string; detailLabel: string; calls: number };

type PlacesUsage = {
  days: readonly PlacesUsageDay[];
  today: number;
  month: number;
  callers: readonly { id: string; label: string; calls: number }[];
  outcomes: { ok: number; empty: number; timeout: number; quota: number; error: number };
};

type PlacesUsageCardProps = {
  usage: PlacesUsage | null;
  locale?: string;
  className?: string;
};

/** The names of the five ways a call can end (static keys, so the messages check can see them). */
const OUTCOME_WORDS = {
  ok: "domain.placesUsage.outcomes.ok",
  empty: "domain.placesUsage.outcomes.empty",
  timeout: "domain.placesUsage.outcomes.timeout",
  quota: "domain.placesUsage.outcomes.quota",
  error: "domain.placesUsage.outcomes.error",
} as const;
const OUTCOME_KEYS = ["ok", "empty", "timeout", "quota", "error"] as const;

function PlacesUsageCard({ usage, locale = "en", className }: PlacesUsageCardProps) {
  const translate = useTranslations();
  const title = translate("domain.placesUsage.title");
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  if (usage === null) {
    return (
      <div data-slot="places-usage-card" className={cn("flex flex-col gap-4", className)}>
        <ChartCard
          title={title}
          description={translate("domain.placesUsage.description")}
          empty={{
            title: translate("domain.placesUsage.empty.title"),
            text: translate("domain.placesUsage.empty.text"),
          }}
        >
          {null}
        </ChartCard>
      </div>
    );
  }

  const problems = usage.outcomes.timeout + usage.outcomes.quota + usage.outcomes.error;
  const series: LineChartSeries[] = [
    {
      id: "calls",
      name: translate("domain.placesUsage.series"),
      slot: 1,
      data: usage.days.map((day) => day.calls),
    },
  ];
  const labels = usage.days.map((day) => day.label);
  const detailLabels = usage.days.map((day) => day.detailLabel);

  return (
    <div data-slot="places-usage-card" className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label={translate("domain.placesUsage.today")}
          value={number(usage.today)}
          icon={<Icon icon={Activity} />}
        />
        <StatTile
          label={translate("domain.placesUsage.month")}
          value={number(usage.month)}
          icon={<Icon icon={CalendarDays} />}
          iconTone="info"
        />
        <StatTile
          label={translate("domain.placesUsage.problems")}
          value={number(problems)}
          icon={<Icon icon={TriangleAlert} />}
          iconTone={problems > 0 ? "warning" : "primary"}
          note={translate(
            problems > 0 ? "domain.placesUsage.problemsSome" : "domain.placesUsage.problemsNone",
          )}
          attention={problems > 0}
        />
      </div>
      <ChartCard
        title={title}
        description={translate("domain.placesUsage.description")}
        words={{
          views: translate("admin.overview.charts.views.label"),
          chart: translate("admin.overview.charts.views.chart"),
          table: translate("admin.overview.charts.views.table"),
        }}
        table={
          <ChartTable
            caption={title}
            xName={translate("domain.placesUsage.dateColumn")}
            labels={detailLabels}
            series={series}
            locale={locale}
          />
        }
      >
        <LineChart
          title={title}
          labels={labels}
          detailLabels={detailLabels}
          series={series}
          locale={locale}
        />
      </ChartCard>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard
          title={translate("domain.placesUsage.callers.title")}
          description={translate("domain.placesUsage.callers.description")}
        >
          <BarList
            title={translate("domain.placesUsage.callers.title")}
            locale={locale}
            rows={usage.callers.map((caller) => ({
              id: caller.id,
              label: caller.label,
              value: caller.calls,
            }))}
          />
        </ChartCard>
        <ChartCard
          title={translate("domain.placesUsage.outcomes.title")}
          description={translate("domain.placesUsage.outcomes.description")}
        >
          <BarList
            title={translate("domain.placesUsage.outcomes.title")}
            locale={locale}
            rows={OUTCOME_KEYS.map((key) => ({
              id: key,
              label: translate(OUTCOME_WORDS[key]),
              value: usage.outcomes[key],
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}

export { PlacesUsageCard };
export type { PlacesUsage, PlacesUsageCardProps, PlacesUsageDay };
