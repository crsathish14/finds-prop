"use client";

import { Star, Trash2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ProjectsManager,
  type ProjectMenuItem,
  type ProjectRow,
  type ProjectRowAction,
} from "@/components/domain/projects-manager";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  NO_DATES,
  PromotionDatesFields,
  PromotionStatusTag,
  type PromotionDatesValue,
} from "@/features/promotion-dates";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatPrice } from "@/lib/format";
import { notify } from "@/lib/notify";
import {
  endsBeforeStart,
  featuredPromotion,
  hasFeaturedDays,
  promotionStatus,
} from "@/lib/promotion-dates";
import { publicEnv } from "@/lib/public-env";
import { PROJECT_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import type { ActionResult } from "@/types/action";
import type { ProjectDecision } from "./constants";
import { featureChoices, type AdminProjectRow } from "./view";

/** The words that say what the one price means ("{price} per sq ft"); a price type this page does not know is shown without them. */
const PRICE_TYPE_KEYS: Record<string, string> = {
  per_sqft: "domain.projectCard.priceType.perSqft",
  basic: "domain.projectCard.priceType.basic",
  all_inclusive: "domain.projectCard.priceType.allInclusive",
  rent_per_month: "domain.projectCard.priceType.rentPerMonth",
  rent_per_sqft_month: "domain.projectCard.priceType.rentPerSqftMonth",
};

type AdminProjectsProps = {
  rows: AdminProjectRow[];
  /** True when the list was cut at the most the page reads. */
  truncated?: boolean;
  actions: {
    moderate: (input: {
      projectId: string;
      decision: ProjectDecision;
      featuredFrom?: string;
      featuredUntil?: string;
    }) => Promise<ActionResult<unknown>>;
    remove: (input: { projectId: string }) => Promise<ActionResult<unknown>>;
  };
  /** The address of the storage service, for the covers; defaults to the project's own. */
  mediaBaseUrl?: string;
  /** Today's India date, from the server, for the Scheduled, Running or Ended tag of a Featured with dates (ADR-210). */
  today: string;
};

type Tab = "all" | "pending" | "approved" | "rejected" | "draft";
const TABS: Tab[] = ["all", "pending", "approved", "rejected", "draft"];

/** The states a project's badge can show; anything else the database might hold is shown as Pending. */
const STATES = ["draft", "pending", "approved", "rejected"] as const;
type State = (typeof STATES)[number];
const stateOf = (moderation: string): State =>
  (STATES as readonly string[]).includes(moderation) ? (moderation as State) : "pending";

/**
 * The admin's Projects page (S7-T04, FR-ADM-03): the projects list in admin mode, for every builder's projects. It
 * filters what it was given by status, builder and a search of the name, place and builder in the browser, and calls
 * the two actions it is given. Each row offers the one thing its state needs (Approve and Reject for Pending,
 * Approve for Rejected, Publish or Unpublish for Approved) and a More menu (Edit, Feature, View live page, Delete).
 * Reject and Delete ask first. Delete is not offered for a project with leads (BR-44); if the database refuses it
 * anyway, the page says why. After a change the page is read again, so it shows what the server holds.
 */
export function AdminProjects({
  rows,
  truncated = false,
  actions,
  mediaBaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  today,
}: AdminProjectsProps) {
  const translate = useTranslations("admin.projects");
  const datesWords = useTranslations("admin.promotionDates");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [builder, setBuilder] = useState("");
  const [rejecting, setRejecting] = useState<AdminProjectRow | null>(null);
  const [deleting, setDeleting] = useState<AdminProjectRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [featuring, setFeaturing] = useState<AdminProjectRow | null>(null);
  const [featureDates, setFeatureDates] = useState<PromotionDatesValue>(NO_DATES);
  const [featureError, setFeatureError] = useState<string | undefined>(undefined);

  const count = (state: Tab) =>
    state === "all" ? rows.length : rows.filter((row) => stateOf(row.moderation) === state).length;

  const tabWords: Record<Tab, string> = {
    all: translate("tabs.all"),
    pending: translate("tabs.pending"),
    approved: translate("tabs.approved"),
    rejected: translate("tabs.rejected"),
    draft: translate("tabs.draft"),
  };

  const builders = [...new Map(rows.map((row) => [row.builderId, row.builderName])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((first, second) => first.label.localeCompare(second.label));

  const priceText = (row: AdminProjectRow): string => {
    if (row.price === null) return translate("noPrice");
    const amount = formatPrice(everything, locale, row.price);
    const key = row.priceType === null ? undefined : PRICE_TYPE_KEYS[row.priceType];
    return key === undefined ? amount : everything(key, { price: amount });
  };

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (tab === "all" || stateOf(row.moderation) === tab) &&
      (builder === "" || row.builderId === builder) &&
      (needle === "" ||
        row.name.toLowerCase().includes(needle) ||
        row.locality.toLowerCase().includes(needle) ||
        row.builderName.toLowerCase().includes(needle)),
  );

  /** A failure with no box to blame: said in a toast, and the page is read again so it shows the truth. */
  const reportFailure = (failure: Extract<ActionResult<unknown>, { ok: false }>) => {
    notify.error(
      failure.code === "CONFLICT" || failure.code === "NOT_FOUND"
        ? translate("conflict")
        : failureText(everything, failure),
    );
    router.refresh();
  };

  /**
   * Makes one decision. A feature sends only the days that are filled in; it closes its dialog when it works, and
   * keeps it open with the error under the end date when the database refuses the days.
   */
  const decide = async (
    row: AdminProjectRow,
    decision: ProjectDecision,
    dates: PromotionDatesValue = NO_DATES,
  ) => {
    const key = `${row.id}:${decision}`;
    if (busy) return;
    setBusy(key);
    try {
      const result = await actions.moderate({
        projectId: row.id,
        decision,
        ...(decision === "feature" && dates.startsOn !== ""
          ? { featuredFrom: dates.startsOn }
          : {}),
        ...(decision === "feature" && dates.endsOn !== "" ? { featuredUntil: dates.endsOn } : {}),
      });
      if (!result.ok) {
        const field =
          decision === "feature"
            ? (result.fieldErrors?.["featuredUntil"]?.[0] ??
              result.fieldErrors?.["featuredFrom"]?.[0])
            : undefined;
        if (field) {
          setFeatureError(fieldErrorText(everything, field));
          return;
        }
        if (decision === "feature") setFeaturing(null);
        reportFailure(result);
        return;
      }
      if (decision === "feature") setFeaturing(null);
      const done: Record<ProjectDecision, string> = {
        approve: translate("toast.approve", { name: row.name }),
        reject: translate("toast.reject", { name: row.name }),
        publish: translate("toast.publish", { name: row.name }),
        unpublish: translate("toast.unpublish", { name: row.name }),
        feature: translate("toast.feature", { name: row.name }),
        unfeature: translate("toast.unfeature", { name: row.name }),
      };
      notify.success(done[decision]);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  /** Feature asks for its dates first; a project that already has dates opens with them filled in. */
  const openFeature = (row: AdminProjectRow) => {
    setFeatureDates({ startsOn: row.featuredFrom ?? "", endsOn: row.featuredUntil ?? "" });
    setFeatureError(undefined);
    setFeaturing(row);
  };

  const confirmFeature = () => {
    if (!featuring) return;
    const typed = {
      ...(featureDates.startsOn === "" ? {} : { startsOn: featureDates.startsOn }),
      ...(featureDates.endsOn === "" ? {} : { endsOn: featureDates.endsOn }),
    };
    if (endsBeforeStart(typed)) {
      setFeatureError(everything("validation.promotionDatesOrder"));
      return;
    }
    setFeatureError(undefined);
    void decide(featuring, "feature", featureDates);
  };

  const remove = async (row: AdminProjectRow) => {
    if (busy) return;
    setBusy(`${row.id}:delete`);
    try {
      const result = await actions.remove({ projectId: row.id });
      setDeleting(null);
      if (!result.ok) {
        // Leads arrived since the page was read: say why, and read the page again for the new count.
        if (result.code === "CONFLICT") setBlockedId(row.id);
        reportFailure(result);
        return;
      }
      notify.success(translate("toast.delete", { name: row.name }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const toRow = (row: AdminProjectRow): ProjectRow => {
    const state = stateOf(row.moderation);
    const live = state === "approved" && row.published;
    const action = (
      id: ProjectDecision,
      label: string,
      tone: ProjectRowAction["tone"],
      icon?: ProjectRowAction["icon"],
      ask?: () => void,
    ): ProjectRowAction => ({
      id,
      label,
      forName: row.name,
      tone,
      ...(icon ? { icon } : {}),
      onClick: ask ?? (() => void decide(row, id)),
      pending: busy === `${row.id}:${id}`,
    });

    const main: ProjectRowAction[] =
      state === "pending"
        ? [
            action("approve", translate("actions.approve"), "primary", "check"),
            action("reject", translate("actions.reject"), "danger-outline", "cross", () =>
              setRejecting(row),
            ),
          ]
        : state === "rejected"
          ? [action("approve", translate("actions.approve"), "secondary", "check")]
          : state === "approved"
            ? [
                row.published
                  ? action("unpublish", translate("actions.unpublish"), "secondary")
                  : action("publish", translate("actions.publish"), "primary", "upload"),
              ]
            : [];

    const menu: ProjectMenuItem[] = [
      {
        id: "edit",
        label: translate("menu.edit"),
        icon: "edit",
        href: `/admin/projects/${row.id}`,
      },
      ...featureChoices(row).map((choice) => ({
        id: choice,
        label: choice === "feature" ? translate("menu.feature") : translate("menu.unfeature"),
        icon: "star" as const,
        onSelect: () => (choice === "feature" ? openFeature(row) : void decide(row, choice)),
      })),
      ...(live
        ? [
            {
              id: "live",
              label: translate("menu.viewLive"),
              icon: "external" as const,
              href: `/projects/${row.slug}`,
            },
          ]
        : []),
      row.leads > 0
        ? {
            id: "delete",
            label: translate("menu.deleteBlocked", { count: row.leads }),
            icon: "trash",
            destructive: true,
            disabled: true,
          }
        : {
            id: "delete",
            label: translate("menu.delete"),
            icon: "trash",
            destructive: true,
            onSelect: () => setDeleting(row),
          },
    ];

    return {
      id: row.id,
      name: row.name,
      place: row.locality,
      builder: row.builderName,
      cover: row.cover
        ? {
            src: publicStorageUrl(mediaBaseUrl, PROJECT_BUCKET, row.cover),
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
          {hasFeaturedDays(row) ? (
            <PromotionStatusTag status={promotionStatus(featuredPromotion(row), today)} />
          ) : null}
        </>
      ),
      actions: main,
      menu,
      moreLabel: translate("moreFor", { name: row.name }),
    };
  };

  const blocked = rows.find((row) => row.id === blockedId && row.leads > 0);

  return (
    <>
      <ProjectsManager
        mode="admin"
        title={translate("title")}
        intro={translate("intro")}
        addLabel={translate("add")}
        addHref="/admin/projects/new"
        tabs={TABS.map((value) => ({
          value,
          label: tabWords[value],
          count: count(value),
          ...(value === "pending" && count(value) > 0 ? { countTone: "new" as const } : {}),
        }))}
        tab={tab}
        onTabChange={(value) => setTab(TABS.includes(value as Tab) ? (value as Tab) : "all")}
        tabsLabel={translate("tabsLabel")}
        search={{
          value: query,
          onChange: setQuery,
          label: translate("search"),
          placeholder: translate("search"),
        }}
        builderFilter={{
          label: translate("builderFilter.label"),
          allLabel: translate("builderFilter.all"),
          options: builders,
          value: builder,
          onChange: setBuilder,
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
        notice={
          <>
            {blocked ? (
              <Alert tone="danger" title={translate("deleteBlocked.title")}>
                {translate("deleteBlocked.text", { count: blocked.leads })}
              </Alert>
            ) : null}
            {truncated ? <Alert tone="info">{translate("truncated")}</Alert> : null}
          </>
        }
        empty={
          rows.length === 0
            ? { title: translate("empty.title"), text: translate("empty.text") }
            : { title: translate("noMatch.title"), text: translate("noMatch.text") }
        }
      />
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => (open ? undefined : setRejecting(null))}
        tone="danger"
        icon={<Icon icon={XCircle} size="lg" />}
        title={translate("rejectDialog.title", { name: rejecting?.name ?? "" })}
        description={translate("rejectDialog.text")}
        confirmLabel={translate("rejectDialog.confirm")}
        cancelLabel={translate("cancel")}
        loading={busy !== null && rejecting !== null && busy === `${rejecting.id}:reject`}
        onConfirm={() => {
          if (!rejecting) return;
          const row = rejecting;
          setRejecting(null);
          void decide(row, "reject");
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        tone="danger"
        icon={<Icon icon={Trash2} size="lg" />}
        title={translate("deleteDialog.title", { name: deleting?.name ?? "" })}
        description={translate("deleteDialog.text")}
        confirmLabel={translate("deleteDialog.confirm")}
        cancelLabel={translate("cancel")}
        loading={busy !== null && deleting !== null && busy === `${deleting.id}:delete`}
        onConfirm={() => (deleting ? void remove(deleting) : undefined)}
      />
      <ConfirmDialog
        open={featuring !== null}
        onOpenChange={(open) => {
          if (!open && busy === null) setFeaturing(null);
        }}
        tone="info"
        icon={<Icon icon={Star} size="lg" />}
        title={translate("menu.feature")}
        description={datesWords("note")}
        confirmLabel={translate("menu.feature")}
        cancelLabel={translate("cancel")}
        loading={featuring !== null && busy === `${featuring.id}:feature`}
        onConfirm={confirmFeature}
      >
        <PromotionDatesFields
          value={featureDates}
          onChange={(value) => {
            setFeatureDates(value);
            setFeatureError(undefined);
          }}
          today={today}
          disabled={featuring !== null && busy === `${featuring.id}:feature`}
          errors={{ endsOn: featureError }}
          {...(featuring ? { subject: featuring.name } : {})}
        />
      </ConfirmDialog>
    </>
  );
}
