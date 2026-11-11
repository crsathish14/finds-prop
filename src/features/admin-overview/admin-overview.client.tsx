"use client";

import {
  Bell,
  Briefcase,
  CircleCheck,
  Clock,
  Heart,
  Inbox,
  MessageSquare,
  RefreshCw,
  Tag,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { formatCount } from "@/lib/chart-scale";
import { isOverviewRange, overviewHref, type ResolvedOverviewRange } from "./range";
import type { Ago, Overview, RecentLeadRow } from "./view";

/** What the server read: the numbers (with the days they were read for), or that the read failed. */
export type OverviewState =
  { ok: true; overview: Overview; range: ResolvedOverviewRange } | { ok: false };

type AdminOverviewProps = {
  /** The page's own address, so the choices stay on it. */
  path: string;
  state: OverviewState;
  /** The choice in the address (it may be ahead of the numbers on show while they reload or when the read failed). */
  filters: ResolvedOverviewRange;
};

type Shown = { overview: Overview; range: ResolvedOverviewRange };

const INTL_LOCALES: Record<string, string> = { en: "en-IN" };
const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? "en-IN";

/** A day (`YYYY-MM-DD`) as "1 Oct" (and "1 Oct 2026" with the year); the day is a calendar day, so no time zone moves it. */
function dayLabel(day: string, locale: string, withYear: boolean): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(date);
}

/** The first letters of the first two words of a name, in capitals. */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toUpperCase();
}

/**
 * The admin's Overview page (S7-T06 part 3, FR-ADM-01): the Insights panel with the admin's numbers, and under it the
 * charts and the newest leads. The date choice is in the address, so a choice reads the page again for it; the numbers
 * already on screen stay (and an "Updating" line shows) until the new ones arrive. When a read fails, the last numbers
 * that did arrive stay under a notice with a way to try again; with none, the notice is all there is. It keeps nothing
 * the server does not also know.
 */
export function AdminOverview({ path, state, filters }: AdminOverviewProps) {
  const translate = useTranslations("admin.overview");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The last numbers that arrived, kept for a failed read (React's way to derive state from props while rendering).
  const [kept, setKept] = useState<Shown | null>(state.ok ? state : null);
  if (state.ok && kept?.overview !== state.overview) setKept(state);
  const shown: Shown | null = state.ok ? state : kept;

  const go = (choice: Partial<ResolvedOverviewRange>) => {
    const next = { ...filters, ...choice };
    startTransition(() => router.push(overviewHref(path, next)));
  };
  const retry = () => startTransition(() => router.refresh());

  const number = (value: number) => formatCount(locale, value);
  const tile = (
    id: string,
    label: string,
    value: string,
    icon: LucideIcon,
    extra: Partial<InsightsTile> = {},
  ): InsightsTile => ({ id, label, value, icon: <Icon icon={icon} size="sm" />, ...extra });

  const groups: InsightsGroup[] = shown
    ? [
        {
          id: "listings",
          label: translate("groups.listings"),
          tiles: [
            tile("total", translate("tiles.total"), number(shown.overview.listings.total), Tag),
            tile(
              "active",
              translate("tiles.active"),
              number(shown.overview.listings.approved),
              CircleCheck,
            ),
            tile(
              "waiting",
              translate("tiles.waiting"),
              number(shown.overview.listings.pending),
              Clock,
              { iconTone: "warning", note: translate("notes.review") },
            ),
          ],
        },
        {
          id: "people",
          label: translate("groups.people"),
          tiles: [
            tile(
              "customers",
              translate("tiles.customers"),
              number(shown.overview.people.customers),
              Users,
            ),
            tile(
              "agents",
              translate("tiles.agents"),
              number(shown.overview.people.agents),
              UserRound,
              { note: translate("notes.agents") },
            ),
            tile(
              "builders",
              translate("tiles.builders"),
              number(shown.overview.people.builders),
              Briefcase,
            ),
          ],
        },
        {
          id: "engagement",
          label: translate("groups.engagement"),
          tiles: [
            tile("leads", translate("tiles.leads"), number(shown.overview.leads.total), Inbox, {
              iconTone: "copper",
            }),
            tile("today", translate("tiles.today"), number(shown.overview.leads.today), Bell, {
              iconTone: "copper",
            }),
            tile(
              "enquiries",
              translate("tiles.enquiries"),
              number(shown.overview.leads.enquiries),
              MessageSquare,
              { iconTone: "info" },
            ),
            tile(
              "shortlisted",
              translate("tiles.shortlisted"),
              number(shown.overview.leads.shortlists),
              Heart,
            ),
            tile(
              "conversion",
              translate("tiles.conversion"),
              shown.overview.conversion === null
                ? translate("noValue")
                : translate("percent", {
                    value: new Intl.NumberFormat(intlLocale(locale), {
                      maximumFractionDigits: 1,
                    }).format(shown.overview.conversion),
                  }),
              TrendingUp,
              { note: translate("notes.conversion") },
            ),
          ],
        },
      ]
    : [];

  return (
    <InsightsPanel
      title={translate("title")}
      intro={translate("intro")}
      notice={
        state.ok ? undefined : (
          <Alert tone="danger" title={translate("error.title")}>
            <p>{shown ? translate("error.kept") : translate("error.text")}</p>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={pending}
                iconStart={<Icon icon={RefreshCw} size="sm" />}
                onClick={retry}
              >
                {common("tryAgain")}
              </Button>
            </div>
          </Alert>
        )
      }
      range={{
        label: translate("range.label"),
        options: [
          { value: "today", label: translate("range.today") },
          { value: "yesterday", label: translate("range.yesterday") },
          { value: "7", label: translate("range.days7") },
          { value: "30", label: translate("range.days30") },
          { value: "month", label: translate("range.thisMonth") },
          { value: "custom", label: translate("range.custom") },
        ],
        value: filters.range,
        onChange: (value) => (isOverviewRange(value) ? go({ range: value }) : undefined),
      }}
      customRange={{
        fromLabel: translate("range.from"),
        toLabel: translate("range.to"),
        from: filters.from,
        to: filters.to,
        // An emptied box has no day to read the page for, so it is left until a day is typed.
        onFromChange: (from) => (from === "" ? undefined : go({ range: "custom", from })),
        onToChange: (to) => (to === "" ? undefined : go({ range: "custom", to })),
      }}
      groups={groups}
    >
      {shown ? (
        <div aria-busy={pending} className={pending ? "pointer-events-none" : undefined}>
          <div className="flex flex-col gap-4">
            {pending ? (
              <p className="flex items-center gap-3 text-small text-muted">
                <Spinner label={translate("updating")} />
                {translate("updating")}
              </p>
            ) : null}
            <OverviewCharts overview={shown.overview} range={shown.range} />
          </div>
        </div>
      ) : null}
    </InsightsPanel>
  );
}

/** The four charts and the recent leads, drawn for the numbers on show. */
function OverviewCharts({ overview, range }: { overview: Overview; range: ResolvedOverviewRange }) {
  const translate = useTranslations("admin.overview");
  const locale = useLocale();
  const number = (value: number) => formatCount(locale, value);
  const crossesYears = range.from.slice(0, 4) !== range.to.slice(0, 4);
  const labels = overview.daily.map((entry) => dayLabel(entry.day, locale, false));
  const detailLabels = overview.daily.map((entry) => dayLabel(entry.day, locale, true));
  const series: LineChartSeries[] = [
    {
      id: "shortlists",
      name: translate("charts.daily.shortlists"),
      slot: 1,
      data: overview.daily.map((entry) => entry.shortlists),
    },
    {
      id: "leads",
      name: translate("charts.daily.leads"),
      slot: 2,
      data: overview.daily.map((entry) => entry.leads),
    },
    {
      id: "enquiries",
      name: translate("charts.daily.enquiries"),
      slot: 3,
      data: overview.daily.map((entry) => entry.enquiries),
    },
  ];
  const dailyTitle = translate("charts.daily.label");
  const sourcesTotal =
    overview.sources.projectPages +
    overview.sources.propertyEnquiries +
    overview.sources.otherForms;

  const kindLabel = (kind: RecentLeadRow["kind"]) => {
    if (kind === "enquiry") return translate("charts.recent.kinds.enquiry");
    if (kind === "site_visit") return translate("charts.recent.kinds.siteVisit");
    if (kind === "brochure") return translate("charts.recent.kinds.brochure");
    return translate("charts.recent.message");
  };
  const when = (ago: Ago): string => {
    if (ago.unit === "date") return ago.day === "" ? "" : dayLabel(ago.day, locale, true);
    if (ago.unit === "now") return translate("charts.recent.when.now");
    if (ago.unit === "yesterday") return translate("charts.recent.when.yesterday");
    if (ago.unit === "minutes")
      return translate("charts.recent.when.minutes", { count: ago.count });
    if (ago.unit === "hours") return translate("charts.recent.when.hours", { count: ago.count });
    return translate("charts.recent.when.days", { count: ago.count });
  };
  const recent: RecentLead[] = overview.recent.map((lead) => {
    const name = lead.name ?? translate("charts.recent.someone");
    return {
      id: lead.id,
      name,
      initials: initialsOf(name),
      meta: translate("charts.recent.meta", { label: lead.label, what: kindLabel(lead.kind) }),
      when: when(lead.ago),
      tone: lead.kind === "site_visit" || lead.kind === "brochure" ? "copper" : "default",
    };
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={translate("charts.daily.title")}
          description={
            range.from === range.to
              ? translate("charts.daily.perDayOne", {
                  day: dayLabel(range.from, locale, crossesYears),
                })
              : translate("charts.daily.perDay", {
                  from: dayLabel(range.from, locale, crossesYears),
                  to: dayLabel(range.to, locale, crossesYears),
                })
          }
          words={{
            views: translate("charts.views.label"),
            chart: translate("charts.views.chart"),
            table: translate("charts.views.table"),
          }}
          table={
            <ChartTable
              caption={dailyTitle}
              xName={translate("charts.daily.dateColumn")}
              labels={detailLabels}
              series={series}
              locale={locale}
            />
          }
          empty={
            overview.active
              ? undefined
              : {
                  title: translate("charts.daily.empty.title"),
                  text: translate("charts.daily.empty.text"),
                }
          }
        >
          <LineChart
            title={dailyTitle}
            labels={labels}
            detailLabels={detailLabels}
            series={series}
            locale={locale}
          />
        </ChartCard>
        <ChartCard
          title={translate("charts.sources.title")}
          description={translate("charts.sources.description", { count: number(sourcesTotal) })}
          empty={
            sourcesTotal > 0
              ? undefined
              : {
                  title: translate("charts.sources.empty.title"),
                  text: translate("charts.sources.empty.text"),
                }
          }
        >
          <ShareBar
            title={translate("charts.sources.label")}
            locale={locale}
            parts={[
              {
                id: "project-pages",
                name: translate("charts.sources.projectPages"),
                value: overview.sources.projectPages,
              },
              {
                id: "property-enquiries",
                name: translate("charts.sources.propertyEnquiries"),
                value: overview.sources.propertyEnquiries,
              },
              {
                id: "other-forms",
                name: translate("charts.sources.otherForms"),
                value: overview.sources.otherForms,
              },
            ]}
          />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard
          title={translate("charts.projects.title")}
          {...(overview.topProjects.length > 0
            ? {
                description: translate("charts.projects.description", {
                  count: overview.topProjects.length,
                }),
              }
            : {})}
          empty={
            overview.topProjects.length > 0
              ? undefined
              : {
                  title: translate("charts.projects.empty.title"),
                  text: translate("charts.projects.empty.text"),
                }
          }
        >
          <BarList
            title={translate("charts.projects.label")}
            locale={locale}
            rows={overview.topProjects.map((project) => ({
              id: project.id,
              label: project.name,
              value: project.enquiries,
            }))}
          />
        </ChartCard>
        <ChartCard
          title={translate("charts.recent.title")}
          action={
            <Link href="/admin/leads" variant="arrow">
              {translate("charts.recent.all")}
            </Link>
          }
        >
          <RecentLeads
            leads={recent}
            label={translate("charts.recent.label")}
            empty={{
              title: translate("charts.recent.empty.title"),
              text: translate("charts.recent.empty.text"),
            }}
          />
        </ChartCard>
      </div>
    </>
  );
}
