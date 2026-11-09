"use client";

import {
  Building2,
  CalendarDays,
  CircleCheck,
  Download,
  Eye,
  Heart,
  Inbox,
  Layers,
  MessageSquare,
  Phone,
  Scale,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  InsightsPanel,
  type InsightsGroup,
  type InsightsTile,
} from "@/components/domain/insights-panel";
import { Alert } from "@/components/patterns/alert";
import { Icon } from "@/components/ui/icon";
import { insightsHref, isInsightsRange, type InsightsRange } from "./range";
import type { InsightsNumbers, PendingNotice } from "./view";

type BuilderInsightsProps = {
  /** The Dashboard (three groups, no project box) or the Insights page (two groups and the project box). */
  variant: "dashboard" | "insights";
  /** The page's own address, so the choices stay on it. */
  path: string;
  numbers: InsightsNumbers;
  /** What the numbers were read for; the days are spelled out for every range. */
  filters: { range: InsightsRange; from: string; to: string; project: string };
  projects: { id: string; name: string }[];
  pending: PendingNotice;
};

/**
 * The builder's Dashboard and Insights pages (S7-T03 step E, FR-BLD-06): the Insights panel with the builder's numbers.
 * The date choice and the project are in the address, so a choice reads the page again for it. It keeps nothing the
 * server does not also know. Charts are not part of it (they wait for the chart spike).
 */
export function BuilderInsights({
  variant,
  path,
  numbers,
  filters,
  projects,
  pending,
}: BuilderInsightsProps) {
  const translate = useTranslations("builderPortal.insights");
  const locale = useLocale();
  const router = useRouter();
  const format = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale);

  const tile = (
    id: string,
    label: string,
    value: number,
    icon: LucideIcon,
    extra: Partial<InsightsTile> = {},
  ): InsightsTile => ({
    id,
    label,
    value: format.format(value),
    icon: <Icon icon={icon} size="sm" />,
    ...extra,
  });

  const portfolio: InsightsGroup = {
    id: "portfolio",
    label: translate("groups.portfolio"),
    tiles: [
      tile("projects", translate("tiles.projects"), numbers.projects, Building2),
      tile("active", translate("tiles.activeProjects"), numbers.activeProjects, CircleCheck, {
        note: translate("notes.activeProjects"),
      }),
      tile("units", translate("tiles.totalUnits"), numbers.totalUnits, Layers),
      tile("available", translate("tiles.availableUnits"), numbers.availableUnits, Tag, {
        note: translate("notes.soldUnits", { count: numbers.soldUnits }),
      }),
    ],
  };
  const activity: InsightsGroup = {
    id: "activity",
    label: translate(filters.range === "month" ? "groups.activityMonth" : "groups.activity"),
    tiles: [
      tile("views", translate("tiles.views"), numbers.views, Eye),
      tile("visitors", translate("tiles.visitors"), numbers.visitors, Users),
      tile("enquiries", translate("tiles.enquiries"), numbers.enquiries, MessageSquare, {
        iconTone: "info",
      }),
      tile("leads", translate("tiles.leads"), numbers.leads, Inbox, { iconTone: "copper" }),
      tile("shortlists", translate("tiles.shortlists"), numbers.shortlists, Heart),
    ],
  };
  const actions: InsightsGroup = {
    id: "actions",
    label: translate("groups.actions"),
    tiles: [
      tile("comparisons", translate("tiles.comparisons"), numbers.comparisons, Scale),
      tile("brochures", translate("tiles.brochures"), numbers.brochures, Download),
      tile("calls", translate("tiles.calls"), numbers.calls, Phone),
      tile("whatsapp", translate("tiles.whatsapp"), numbers.whatsapp, MessageSquare),
      tile("visits", translate("tiles.siteVisits"), numbers.siteVisits, CalendarDays),
    ],
  };

  const go = (choice: Partial<typeof filters>) => {
    const next = { ...filters, ...choice };
    router.push(insightsHref(path, next));
  };

  const dashboard = variant === "dashboard";
  return (
    <InsightsPanel
      title={translate(dashboard ? "dashboard.title" : "insights.title")}
      intro={translate(dashboard ? "dashboard.intro" : "insights.intro")}
      notice={
        pending.count > 0 ? (
          <Alert tone="warning" title={translate("pending.title", { count: pending.count })}>
            {pending.name === null
              ? translate("pending.many")
              : translate("pending.one", { name: pending.name })}
          </Alert>
        ) : undefined
      }
      range={{
        label: translate("range.label"),
        options: [
          { value: "7", label: translate("range.days7") },
          { value: "30", label: translate("range.days30") },
          { value: "month", label: translate("range.thisMonth") },
          { value: "custom", label: translate("range.custom") },
        ],
        value: filters.range,
        onChange: (value) => (isInsightsRange(value) ? go({ range: value }) : undefined),
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
      {...(dashboard
        ? {}
        : {
            project: {
              label: translate("project.label"),
              allLabel: translate("project.all"),
              options: projects.map((project) => ({ value: project.id, label: project.name })),
              value: filters.project,
              onChange: (project: string) => go({ project }),
            },
          })}
      groups={dashboard ? [portfolio, activity, actions] : [activity, actions]}
    />
  );
}
