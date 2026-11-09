"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadsTable, type LeadRow } from "@/components/domain/leads-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { failureText, type Translator } from "@/i18n/failure-text";
import { formatDate, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { LEAD_STATUSES, type LeadStatus } from "./constants";
import { KIND_KEYS, phoneParts } from "./format";
import type { LeadFilters } from "./schemas";
import type { LeadView, LeadsPage } from "./view";

type Done = ActionResult<{ leadId: string; projectId: string; status: LeadStatus }>;

export type ProjectLeadsActions = {
  setStatus: (input: { leadId: string; status: LeadStatus }) => Promise<Done>;
  loadMore: (input: LeadFilters) => Promise<ActionResult<LeadsPage>>;
};

const KIND_TONES = { enquiry: "info", site_visit: "featured", brochure: "neutral" } as const;

/** The same record without one key. */
const without = <Value,>(record: Record<string, Value>, key: string): Record<string, Value> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

const isStatus = (value: string): value is LeadStatus =>
  (LEAD_STATUSES as readonly string[]).includes(value);

/**
 * The "Project leads" tab (S7-T07, FR-ADM-06): the leads of every project with the one thing the admin can change,
 * the lead's state. A state is saved as soon as it is chosen; the box shows the new state at once and goes back if the
 * save fails. "Show more" adds the next leads in place, and a page read again starts the list over from its first.
 */
export function ProjectLeadsPanel({
  page,
  actions,
}: {
  page: LeadsPage;
  actions: ProjectLeadsActions;
}) {
  const translate = useTranslations("admin.leads");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [more, setMore] = useState<LeadView[]>([]);
  const [laterCursor, setLaterCursor] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chosen, setChosen] = useState<Record<string, LeadStatus>>({});
  const [saving, setSaving] = useState<Record<string, true>>({});

  // A page read again starts the list over from its first leads, with the states the server now holds.
  const [seen, setSeen] = useState(page);
  if (seen !== page) {
    setSeen(page);
    setMore([]);
    setLaterCursor(null);
    setLoadedMore(false);
    setChosen({});
  }

  const leads = [...page.leads, ...more];
  const nextCursor = loadedMore ? laterCursor : page.nextCursor;
  const dash = translate("dash");

  const change = async (lead: LeadView, value: string) => {
    if (!isStatus(value) || saving[lead.id]) return;
    setChosen((previous) => ({ ...previous, [lead.id]: value }));
    setSaving((previous) => ({ ...previous, [lead.id]: true }));
    const result = await actions.setStatus({ leadId: lead.id, status: value });
    setSaving((previous) => without(previous, lead.id));
    if (result.ok) return;
    setChosen((previous) => without(previous, lead.id));
    notify.error(
      result.code === "NOT_FOUND" || result.code === "CONFLICT"
        ? translate("conflict")
        : failureText(everything, result),
    );
    router.refresh();
  };

  const showMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await actions.loadMore({ status: "all", after: nextCursor });
    setLoadingMore(false);
    if (!result.ok) {
      notify.error(translate("showMore.failed"));
      return;
    }
    setMore((previous) => [...previous, ...result.data.leads]);
    setLaterCursor(result.data.nextCursor);
    setLoadedMore(true);
  };

  if (leads.length === 0) {
    return <EmptyState title={translate("empty.title")} description={translate("empty.text")} />;
  }

  const rowOf = (lead: LeadView): LeadRow => ({
    id: lead.id,
    date: `${formatDate(locale, lead.createdAt, "medium")}, ${formatTime(locale, lead.createdAt)}`,
    project: lead.projectName,
    type: (
      <Badge tone={KIND_TONES[lead.kind]}>
        {everything(`admin.leads.kinds.${KIND_KEYS[lead.kind]}`)}
      </Badge>
    ),
    name: lead.name,
    phone: phoneParts(lead.phone),
    email: lead.email ?? dash,
    message: lead.message ?? dash,
    status: {
      value: chosen[lead.id] ?? lead.status,
      label: translate("table.statusFor", { name: lead.name }),
      options: LEAD_STATUSES.map((status) => ({
        value: status,
        label: everything(`admin.leads.states.${status}`),
      })),
      onChange: (value) => void change(lead, value),
      disabled: Boolean(saving[lead.id]),
    },
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <LeadsTable
        caption={translate("table.caption")}
        columns={{
          date: translate("table.date"),
          project: translate("table.project"),
          type: translate("table.type"),
          name: translate("table.name"),
          phone: translate("table.phone"),
          email: translate("table.email"),
          message: translate("table.message"),
          status: translate("table.status"),
        }}
        rows={leads.map(rowOf)}
        countText={translate("count", { shown: leads.length, total: page.total })}
      />
      {nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" loading={loadingMore} onClick={showMore}>
            {translate("showMore.leads")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
