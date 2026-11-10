"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmissionDetail } from "@/components/domain/submission-detail";
import {
  SubmissionsFilters,
  type SubmissionsFilterBox,
} from "@/components/domain/submissions-filters";
import { SubmissionsTable, type SubmissionRow } from "@/components/domain/submissions-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { failureText, type Translator } from "@/i18n/failure-text";
import { formatDate, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import {
  CRM_STATUSES,
  DEFAULT_SUBMISSION_RANGE,
  SUBMISSION_RANGES,
  type CrmFilter,
  type SubmissionRange,
} from "./constants";
import { answerText, leadsHref, phoneParts, RANGE_KEYS, retryDelay } from "./format";
import type { SubmissionFilters } from "./schemas";
import type { FilterOptions, SubmissionView, SubmissionsPage } from "./view";

export type SubmissionsActions = {
  loadMore: (input: SubmissionFilters) => Promise<ActionResult<SubmissionsPage>>;
  /** "Retry delivery now" for one submission; it comes from the CRM feature, passed in by the page. */
  retry: (input: {
    submissionId: string;
  }) => Promise<ActionResult<{ submissionId: string; ok: boolean; status: number | null }>>;
};

type Filters = {
  range: SubmissionRange;
  crm: CrmFilter;
  form?: string;
  project?: string;
  source?: string;
};

/**
 * The "Form submissions" tab (S7-T07, FR-ADM-06): the forms people filled in, the boxes that narrow them and the
 * details of one. The choices are in the address, so the page is read again for them and the count is right.
 * "Show more" adds the next submissions in place, and a page read again starts the list over from its first.
 * A failed delivery has "Retry delivery now" in its details (S7-T09): it sends the submission to its CRM at once and
 * says how it went; the page is read again after, so the state shown is the server's. The list has an Agent column:
 * the CRM connection that took the submission.
 */
export function SubmissionsPanel({
  page,
  filters,
  options,
  actions,
}: {
  page: SubmissionsPage;
  filters: Filters;
  options: FilterOptions;
  actions: SubmissionsActions;
}) {
  const translate = useTranslations("admin.leads");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [more, setMore] = useState<SubmissionView[]>([]);
  const [laterCursor, setLaterCursor] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // A page read again (for other choices) starts the list over from its first submissions.
  const [seen, setSeen] = useState(page);
  if (seen !== page) {
    setSeen(page);
    setMore([]);
    setLaterCursor(null);
    setLoadedMore(false);
  }

  const submissions = [...page.submissions, ...more];
  const nextCursor = loadedMore ? laterCursor : page.nextCursor;
  const opened = submissions.find((submission) => submission.id === openId) ?? null;
  const dash = translate("dash");

  const go = (next: {
    range: SubmissionRange;
    crm: CrmFilter;
    form?: string | undefined;
    project?: string | undefined;
    source?: string | undefined;
  }) =>
    router.push(
      leadsHref({
        tab: "submissions",
        range: next.range,
        form: next.form,
        project: next.project,
        source: next.source,
        crm: next.crm,
      }),
    );

  const choose = (box: SubmissionsFilterBox, value: string) =>
    go({
      range: box === "range" ? (value as SubmissionRange) : filters.range,
      crm: box === "crm" ? (value as CrmFilter) : filters.crm,
      form: box === "form" ? value : filters.form,
      project: box === "project" ? value : filters.project,
      source: box === "source" ? value : filters.source,
    });

  const showMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await actions.loadMore({ ...filters, after: nextCursor });
    setLoadingMore(false);
    if (!result.ok) {
      notify.error(translate("showMore.failed"));
      return;
    }
    setMore((previous) => [...previous, ...result.data.submissions]);
    setLaterCursor(result.data.nextCursor);
    setLoadedMore(true);
  };

  const retryNow = async (submission: SubmissionView) => {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = await actions.retry({ submissionId: submission.id });
      if (!result.ok) {
        if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
          notify.error(everything("admin.crm.toast.retryConflict"));
          router.refresh();
        } else {
          notify.error(failureText(everything, result));
        }
        return;
      }
      if (result.data.ok) {
        notify.success(everything("admin.crm.toast.retried"), {
          description: everything("admin.crm.toast.retriedText"),
        });
      } else {
        notify.error(everything("admin.crm.toast.retryFailed"), {
          description:
            result.data.status === null
              ? everything("admin.crm.toast.retryFailedNoAnswer")
              : everything("admin.crm.toast.retryFailedHttp", { status: result.data.status }),
        });
      }
      router.refresh();
    } finally {
      setRetrying(false);
    }
  };

  const createdText = (iso: string) =>
    `${formatDate(locale, iso, "medium")}, ${formatTime(locale, iso)}`;

  const crmBadge = (submission: SubmissionView) => (
    <>
      <StatusBadge kind="crm" status={submission.crm.status} />
      {submission.crm.leadId ? (
        <small className="text-caption text-muted">{submission.crm.leadId}</small>
      ) : null}
    </>
  );

  const rowOf = (submission: SubmissionView): SubmissionRow => ({
    id: submission.id,
    created: createdText(submission.createdAt),
    name: submission.name ?? dash,
    mobile: submission.mobile ? phoneParts(submission.mobile) : null,
    project: submission.projectName ?? dash,
    source: submission.source ?? dash,
    form: submission.formName,
    agent: submission.agentName ?? dash,
    crm: crmBadge(submission),
    openLabel: translate("submissions.details"),
    openFor: submission.name ?? submission.formName,
    onOpen: () => setOpenId(submission.id),
  });

  /** "CRM delivery failed" with why and when it will be tried again; only for a delivery that failed. */
  const failureOf = (submission: SubmissionView) => {
    if (submission.crm.status !== "failed") return undefined;
    const { httpStatus, attempts, nextRetryAt } = submission.crm;
    const what =
      httpStatus === null
        ? translate("detail.failed.noCode", { attempts })
        : translate("detail.failed.withCode", { code: httpStatus, attempts });
    let when = translate("detail.failed.noRetry");
    if (nextRetryAt) {
      const delay = retryDelay(nextRetryAt, page.readAt);
      const time =
        delay.unit === "soon"
          ? everything("admin.leads.time.soon")
          : everything(`admin.leads.time.${delay.unit}`, { count: delay.count });
      when = translate("detail.failed.retryIn", { time });
    }
    return { title: translate("detail.failed.title"), text: `${what} ${when}` };
  };

  const filtersActive =
    filters.range !== DEFAULT_SUBMISSION_RANGE ||
    filters.crm !== "any" ||
    Boolean(filters.form ?? filters.project ?? filters.source);

  const failure = opened ? failureOf(opened) : undefined;

  const detailWords = {
    created: translate("detail.created"),
    name: translate("detail.name"),
    mobile: translate("detail.mobile"),
    email: translate("detail.email"),
    form: translate("detail.form"),
    project: translate("detail.project"),
    source: translate("detail.source"),
    answers: translate("detail.answers"),
    crm: translate("detail.crm"),
    crmId: translate("detail.crmId"),
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SubmissionsFilters
        values={{
          range: filters.range,
          form: filters.form ?? "",
          project: filters.project ?? "",
          source: filters.source ?? "",
          crm: filters.crm,
        }}
        options={{
          ranges: SUBMISSION_RANGES.map((range) => ({
            value: range,
            label: everything(`admin.leads.submissions.filters.ranges.${RANGE_KEYS[range]}`),
          })),
          forms: options.forms.map((form) => ({ value: form.id, label: form.name })),
          projects: options.projects.map((project) => ({ value: project.id, label: project.name })),
          sources: options.sources.map((source) => ({ value: source, label: source })),
          crms: [
            { value: "any", label: translate("submissions.filters.anyCrm") },
            ...CRM_STATUSES.map((status) => ({
              value: status,
              label: everything(`status.crm.${status}`),
            })),
          ],
        }}
        words={{
          range: translate("submissions.filters.range"),
          form: translate("submissions.filters.form"),
          project: translate("submissions.filters.project"),
          source: translate("submissions.filters.source"),
          crm: translate("submissions.filters.crm"),
          allForms: translate("submissions.filters.allForms"),
          allProjects: translate("submissions.filters.allProjects"),
          allSources: translate("submissions.filters.allSources"),
          reset: translate("submissions.filters.reset"),
        }}
        onChange={choose}
        onReset={() => router.push(leadsHref({ tab: "submissions" }))}
      />
      {submissions.length === 0 ? (
        <EmptyState
          title={translate(filtersActive ? "submissions.noMatch.title" : "submissions.empty.title")}
          description={translate(
            filtersActive ? "submissions.noMatch.text" : "submissions.empty.text",
          )}
        />
      ) : (
        <SubmissionsTable
          caption={translate("submissions.table.caption")}
          columns={{
            created: translate("submissions.table.created"),
            name: translate("submissions.table.name"),
            mobile: translate("submissions.table.mobile"),
            project: translate("submissions.table.project"),
            source: translate("submissions.table.source"),
            form: translate("submissions.table.form"),
            agent: translate("submissions.table.agent"),
            crm: translate("submissions.table.crm"),
            actions: translate("submissions.table.actions"),
          }}
          rows={submissions.map(rowOf)}
          noMobile={dash}
          countText={translate("submissions.count", {
            shown: submissions.length,
            total: page.total,
          })}
          note={translate("submissions.note")}
        />
      )}
      {nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" loading={loadingMore} onClick={showMore}>
            {translate("showMore.submissions")}
          </Button>
        </div>
      ) : null}
      <ManagerDrawer
        open={opened !== null}
        onOpenChange={(open) => (open ? undefined : setOpenId(null))}
        title={translate("detail.title")}
        closeLabel={translate("close")}
        cancelLabel={translate("close")}
      >
        {opened ? (
          <SubmissionDetail
            details={{
              created: createdText(opened.createdAt),
              name: opened.name ?? dash,
              mobile: opened.mobile ? phoneParts(opened.mobile) : null,
              email: opened.email ?? dash,
              form: opened.formName,
              project: opened.projectName ?? dash,
              source: opened.source ?? dash,
            }}
            noMobile={dash}
            answers={opened.answers.map((answer) => ({
              id: answer.key,
              label: answer.label,
              value: answerText(answer.value, {
                yes: translate("detail.yes"),
                no: translate("detail.no"),
              }),
            }))}
            crm={{
              badge: <StatusBadge kind="crm" status={opened.crm.status} />,
              leadId: opened.crm.leadId,
            }}
            {...(failure ? { failure } : {})}
            {...(failure && opened
              ? {
                  retry: {
                    label: translate("detail.retry"),
                    onClick: () => void retryNow(opened),
                    pending: retrying,
                  },
                }
              : {})}
            words={detailWords}
          />
        ) : null}
      </ManagerDrawer>
    </div>
  );
}
