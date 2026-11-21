"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { JobManager, type JobRow } from "@/components/domain/job-manager";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import type { CategoryView } from "@/features/content-categories";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { JobAdminViewName } from "./constants";
import { JobDepartmentsPanel, type JobDepartmentsActions } from "./job-departments-panel.client";
import type { JobDone } from "./job-service";
import {
  ADMIN_CAREERS_NEW_PATH,
  adminJobEditPath,
  adminJobsHref,
  type AdminJobParams,
} from "./page-params";
import type { AdminJobCounts } from "./queries";
import { isJobOpenAt, type AdminJobRowView } from "./view";

export type CareersBoardActions = {
  open: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
  close: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
  trash: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
  restore: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
};

type CareersAdminBoardProps = {
  /** One page of the list, in the admin's order (the newest edit first). */
  rows: AdminJobRowView[];
  /** How many jobs the chosen tab and filters hold, and which page this is. */
  total: number;
  page: number;
  pageCount: number;
  /** How many jobs each tab holds. */
  counts: AdminJobCounts;
  /** The departments of Careers, hidden ones too. */
  departments: CategoryView[];
  /** How many jobs (the Trash too) each department holds, by department id. */
  usage: Record<string, number>;
  /** What the address chose: the tab, the department (an id), the words and the page. */
  params: AdminJobParams;
  actions: CareersBoardActions;
  departmentActions: JobDepartmentsActions;
};

type Step = "open" | "close" | "reopen" | "restore" | "trash";

/** The words of each button's confirmation (static keys, so the messages check can see them). */
const TOAST_WORDS = {
  open: "admin.careers.toast.opened",
  close: "admin.careers.toast.closed",
  reopen: "admin.careers.toast.opened",
  restore: "admin.careers.toast.restored",
  trash: "admin.careers.toast.trashed",
} as const satisfies Record<Step, string>;

const TABS: readonly JobAdminViewName[] = ["all", "open", "draft", "closed", "trash"];
const SEARCH_WAIT_MS = 400;

/**
 * The admin's Careers list (ADR-143, FR-ADM-15): the shared JobManager (heading with Add job and Departments, tabs,
 * department filter, search and the rows with Open, Close posting, Reopen, Restore and Move to Trash), the page links
 * and the departments drawer. The tab, the department, the words and the page are in the address, so a view can be
 * shared and survives a refresh; the page reads the rows. Each button calls the action it is given and the page is read
 * again, so what shows is what is stored. A refusal (a job with no description cannot be opened) says why in a toast; a
 * job that is already gone says so and the list is refreshed.
 */
export function CareersAdminBoard({
  rows,
  total,
  page,
  pageCount,
  counts,
  departments,
  usage,
  params,
  actions,
  departmentActions,
}: CareersAdminBoardProps) {
  const translate = useTranslations("admin.careers");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [pendingId, setPendingId] = useState<string | undefined>(undefined);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [words, setWords] = useState(params.query);
  const typed = useRef(false);

  // The search box types into local state; the address follows a moment after the last key, never on the first render.
  useEffect(() => {
    if (!typed.current) return;
    const timer = setTimeout(() => {
      router.replace(adminJobsHref({ ...params, query: words.trim(), page: 1 }));
    }, SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
    // `params` changes with every address change; only the typed words should restart the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed words restart the wait
  }, [words]);

  const nameOf = (id: string) => departments.find((department) => department.id === id)?.name ?? "";

  const refused = (failure: Extract<ActionResult<unknown>, { ok: false }>): string => {
    if (failure.code === "NOT_FOUND" || failure.code === "CONFLICT") return translate("conflict");
    const first = Object.values(failure.fieldErrors ?? {})[0]?.[0];
    return first ? fieldErrorText(everything, first) : failureText(everything, failure);
  };

  const run = async (id: string, step: Step) => {
    if (pendingId !== undefined) return;
    setPendingId(id);
    try {
      const call = step === "reopen" ? actions.open : actions[step];
      const result = await call({ jobId: id });
      if (result.ok) {
        notify.success(everything(TOAST_WORDS[step]));
        router.refresh();
        return;
      }
      notify.error(refused(result));
      if (result.code === "NOT_FOUND" || result.code === "CONFLICT") router.refresh();
    } finally {
      setPendingId(undefined);
    }
  };

  const now = new Date();
  const listRows: JobRow[] = rows.map((row) => {
    const stepKind: Step = row.trashed
      ? "restore"
      : row.status === "open"
        ? "close"
        : row.status === "closed"
          ? "reopen"
          : "open";
    return {
      id: row.id,
      title: row.title,
      departmentName: nameOf(row.departmentId),
      location: row.location,
      status: row.status,
      trashed: row.trashed,
      expired: row.status === "open" && !isJobOpenAt(row, now),
      updated: formatDate(locale, row.updatedAt),
      closes: row.closesAt ? formatDate(locale, row.closesAt) : null,
      editHref: adminJobEditPath(row.id),
      step: { kind: stepKind, onClick: () => void run(row.id, stepKind) },
      ...(row.trashed ? {} : { trash: { onClick: () => void run(row.id, "trash") } }),
    };
  });

  return (
    <>
      <div className="flex flex-col gap-6">
        <JobManager
          addHref={ADMIN_CAREERS_NEW_PATH}
          onDepartments={() => setDepartmentsOpen(true)}
          tabs={{
            options: TABS.map((value) => ({
              value,
              count: value === "all" ? counts.draft + counts.open + counts.closed : counts[value],
            })),
            value: params.status,
            onChange: (value) => router.push(adminJobsHref({ ...params, status: value, page: 1 })),
          }}
          department={{
            options: departments.map((department) => ({
              value: department.id,
              label: department.active
                ? department.name
                : translate("hiddenDepartment", { name: department.name }),
            })),
            value: params.department,
            onChange: (value) =>
              router.push(adminJobsHref({ ...params, department: value, page: 1 })),
          }}
          search={{
            value: words,
            onChange: (value) => {
              typed.current = true;
              setWords(value);
            },
          }}
          caption={translate("caption")}
          rows={listRows}
          countText={translate("count", { count: total })}
          pending={pendingId !== undefined}
        />
        <PaginationBar
          page={page}
          pageCount={pageCount}
          hrefFor={(number) => adminJobsHref({ ...params, page: number })}
        />
      </div>
      <JobDepartmentsPanel
        open={departmentsOpen}
        onOpenChange={setDepartmentsOpen}
        categories={departments}
        usage={usage}
        actions={departmentActions}
      />
    </>
  );
}
