"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ProjectsManager, type ProjectRow } from "@/components/domain/projects-manager";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type Translate } from "@/lib/format";
import { publicEnv } from "@/lib/public-env";
import { publicMediaUrl } from "./form";
import type { ProjectListRow } from "./view";

type BuilderProjectsProps = {
  rows: ProjectListRow[];
  /** The address of the storage service, for the covers; defaults to the project's own. */
  mediaBaseUrl?: string;
};

type Tab = "all" | "pending" | "approved" | "rejected" | "draft";

const TABS: Tab[] = ["all", "pending", "approved", "rejected", "draft"];

/** The states a project's badge can show; anything else the database might hold is shown as Pending. */
const STATES = ["draft", "pending", "approved", "rejected"] as const;
type State = (typeof STATES)[number];
const stateOf = (moderation: string): State =>
  (STATES as readonly string[]).includes(moderation) ? (moderation as State) : "pending";

/** The words that say what the one price means ("{price} per sq ft"); a price type this page does not know is shown without them. */
const PRICE_TYPE_KEYS: Record<string, string> = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
};

/**
 * The builder's Projects page (S7-T03, FR-BLD-02): the projects list in builder mode, for the builder's own projects. It
 * filters what it was given by status and by a search of the name and place in the browser (a builder's own list is
 * small), and every button is a link: Edit, and View live for a project that is approved and published. A builder
 * cannot approve, reject, publish, feature or delete (the database refuses it too), so none of those is offered.
 */
export function BuilderProjects({
  rows,
  mediaBaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL,
}: BuilderProjectsProps) {
  const translate = useTranslations("builderPortal.projects");
  const everything = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const count = (state: Tab) =>
    state === "all" ? rows.length : rows.filter((row) => stateOf(row.moderation) === state).length;

  const tabWords: Record<Tab, string> = {
    all: translate("tabs.all"),
    pending: translate("tabs.pending"),
    approved: translate("tabs.approved"),
    rejected: translate("tabs.rejected"),
    draft: translate("tabs.draft"),
  };

  const priceText = (row: ProjectListRow): string => {
    if (row.price === null) return translate("noPrice");
    const amount = formatPrice(everything, locale, row.price);
    const key = row.priceType === null ? undefined : PRICE_TYPE_KEYS[row.priceType];
    return key === undefined ? amount : everything(key, { price: amount });
  };

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (tab === "all" || stateOf(row.moderation) === tab) &&
      (needle === "" ||
        row.name.toLowerCase().includes(needle) ||
        row.locality.toLowerCase().includes(needle)),
  );

  const toRow = (row: ProjectListRow): ProjectRow => {
    const state = stateOf(row.moderation);
    const live = state === "approved" && row.published;
    return {
      id: row.id,
      name: row.name,
      place: row.locality,
      cover: row.cover
        ? {
            src: publicMediaUrl(mediaBaseUrl, row.cover),
            alt: translate("coverAlt", { name: row.name }),
          }
        : null,
      priceRange: priceText(row),
      status: (
        <>
          <StatusBadge kind="project" status={state} />
          {state === "approved" ? (
            <Badge tone={row.published ? "info" : "outline"}>
              {row.published ? translate("badges.published") : translate("badges.unpublished")}
            </Badge>
          ) : null}
          {row.featured ? <Badge tone="featured">{translate("badges.featured")}</Badge> : null}
        </>
      ),
      actions: [
        {
          id: "edit",
          label: translate("actions.edit"),
          forName: row.name,
          tone: "secondary",
          icon: "edit",
          href: `/builder/projects/${row.id}`,
        },
        ...(live
          ? [
              {
                id: "live",
                label: translate("actions.viewLive"),
                forName: row.name,
                tone: "ghost" as const,
                icon: "external" as const,
                href: `/projects/${row.slug}`,
              },
            ]
          : []),
      ],
    };
  };

  return (
    <ProjectsManager
      mode="builder"
      title={translate("title")}
      intro={translate("intro")}
      addLabel={translate("add")}
      addHref="/builder/projects/new"
      tabs={TABS.map((value) => ({ value, label: tabWords[value], count: count(value) }))}
      tab={tab}
      onTabChange={(value) => setTab(TABS.includes(value as Tab) ? (value as Tab) : "all")}
      tabsLabel={translate("tabsLabel")}
      search={{
        value: query,
        onChange: setQuery,
        label: translate("search"),
        placeholder: translate("search"),
      }}
      columns={{
        project: translate("columns.project"),
        builder: translate("columns.builder"),
        priceRange: translate("columns.priceRange"),
        status: translate("columns.status"),
        actions: translate("columns.actions"),
      }}
      caption={translate("caption")}
      rows={shown.map(toRow)}
      countText={translate("count", { count: shown.length })}
      reapproval={{ title: translate("reapproval.title"), text: translate("reapproval.text") }}
      empty={
        rows.length === 0
          ? { title: translate("empty.title"), text: translate("empty.text") }
          : { title: translate("noMatch.title"), text: translate("noMatch.text") }
      }
    />
  );
}
