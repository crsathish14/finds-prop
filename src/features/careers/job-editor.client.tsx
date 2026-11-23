"use client";

import { ArrowLeft, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { JobClosePosting } from "@/components/domain/job-close-posting";
import {
  JobFormFields,
  type JobFormErrors,
  type JobFormValues,
} from "@/components/domain/job-form-fields";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import {
  JOB_DESCRIPTION_MAX,
  JOB_EXPERIENCE_MAX,
  JOB_LOCATION_MAX,
  JOB_REQUIREMENTS_MAX,
  JOB_RESPONSIBILITIES_MAX,
  JOB_SALARY_NOTE_MAX,
  JOB_SUMMARY_MAX,
  JOB_TITLE_MAX,
} from "./constants";
import {
  closesAtToInput,
  saveJobForm,
  type JobEditorActions,
  type JobSaveResult,
} from "./job-save";
import type { JobDone } from "./job-service";
import { ADMIN_CAREERS_PATH, adminJobEditPath } from "./page-params";
import type { AdminJobView } from "./view";

export type { JobEditorActions } from "./job-save";

export type JobStatusActions = {
  open: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
  close: (input: { jobId: string }) => Promise<ActionResult<JobDone>>;
};

type JobEditorProps = {
  /** The job being edited, or null for a new one. */
  job: AdminJobView | null;
  /** The departments to choose from (hidden ones are offered too, marked as hidden by the page). */
  departments: { value: string; label: string }[];
  /** The department to start a new job in, when the list was narrowed to one. */
  initialDepartment?: string;
  actions: JobEditorActions;
  statusActions: JobStatusActions;
};

const LIMITS = {
  title: JOB_TITLE_MAX,
  location: JOB_LOCATION_MAX,
  experience: JOB_EXPERIENCE_MAX,
  summary: JOB_SUMMARY_MAX,
  description: JOB_DESCRIPTION_MAX,
  responsibilities: JOB_RESPONSIBILITIES_MAX,
  requirements: JOB_REQUIREMENTS_MAX,
  salaryNote: JOB_SALARY_NOTE_MAX,
};

/** The boxes of the form that a failure can name; anything else goes to a toast. */
const BOXES: readonly (keyof JobFormValues)[] = [
  "title",
  "slug",
  "departmentId",
  "location",
  "workMode",
  "employmentType",
  "experience",
  "summary",
  "description",
  "responsibilities",
  "requirements",
  "salaryNote",
  "applyUrl",
  "applyEmail",
  "closesAt",
];

function boxOf(field: string): keyof JobFormValues | null {
  const head = field.split(".")[0] ?? "";
  return (BOXES as readonly string[]).includes(head) ? (head as keyof JobFormValues) : null;
}

/**
 * The admin's job page (ADR-143, ADR-147, FR-ADM-15): the form (Basics, About the job, How to apply, Closing) above the
 * save bar the project form uses, for a new job or one being edited, with Open job and Close posting for a saved job.
 * `saveJobForm` makes a new job first and then saves everything else, so one press of Save stores the whole form. The
 * values stay typed when a save fails and each problem sits on its box; a failure with no box to blame is a toast. A
 * saved existing job stays on this page, read again; a new one opens at its own address. Putting a job on the site is
 * its own button, and the service names the box that is still empty when it refuses.
 */
export function JobEditor({
  job,
  departments,
  initialDepartment = "",
  actions,
  statusActions,
}: JobEditorProps) {
  const translate = useTranslations("admin.careers.editor");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [jobId, setJobId] = useState<string | null>(job?.id ?? null);
  const [values, setValues] = useState<JobFormValues>({
    title: job?.title ?? "",
    slug: job?.slug ?? "",
    departmentId: job?.departmentId ?? initialDepartment,
    location: job?.location ?? "",
    workMode: job?.workMode ?? "onsite",
    employmentType: job?.employmentType ?? "full_time",
    experience: job?.experience ?? "",
    summary: job?.summary ?? "",
    description: job?.description ?? "",
    responsibilities: job?.responsibilities ?? "",
    requirements: job?.requirements ?? "",
    salaryNote: job?.salaryNote ?? "",
    applyKind: job?.applyEmail ? "email" : "link",
    applyUrl: job?.applyUrl ?? "",
    applyEmail: job?.applyEmail ?? "",
    closesAt: closesAtToInput(job?.closesAt ?? null),
  });
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [closing, setClosing] = useState(false);

  const status = job?.status ?? "draft";
  const isOpen = job !== null && status === "open";

  const showFailure = (result: Extract<JobSaveResult, { ok: false }>) => {
    const boxes: JobFormErrors = {};
    for (const [field, problems] of Object.entries(result.failure.fieldErrors ?? {})) {
      const first = problems[0];
      const box = boxOf(field);
      if (first && box) boxes[box] ??= fieldErrorText(everything, first);
    }
    setErrors(boxes);
    if (Object.keys(boxes).length > 0) return;
    notify.error(
      result.failure.code === "NOT_FOUND"
        ? translate("gone")
        : failureText(everything, result.failure),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveJobForm({ jobId, values, actions });
      if (result.ok) {
        setErrors({});
        notify.success(translate(result.created ? "toast.created" : "toast.saved"));
        if (result.created) router.replace(adminJobEditPath(result.jobId));
        router.refresh();
        return;
      }
      // The job exists once it has been made, even when the update failed: the next save updates it.
      if (result.jobId !== null && jobId === null) {
        setJobId(result.jobId);
        if (values.slug.trim() === "" && result.slug) {
          setValues((current) => ({ ...current, slug: result.slug as string }));
        }
      }
      showFailure(result);
    } finally {
      setSaving(false);
    }
  };

  /** Open job and Close posting: their own actions on the saved job. */
  const change = async (kind: "open" | "close") => {
    if (jobId === null || changing) return;
    setChanging(true);
    try {
      const result = await statusActions[kind]({ jobId });
      if (result.ok) {
        notify.success(translate(kind === "open" ? "toast.opened" : "toast.closed"));
        setClosing(false);
        router.refresh();
        return;
      }
      const first = Object.values(result.fieldErrors ?? {})[0]?.[0];
      notify.error(
        result.code === "NOT_FOUND" || result.code === "CONFLICT"
          ? translate("gone")
          : first
            ? fieldErrorText(everything, first)
            : failureText(everything, result),
      );
      setClosing(false);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ADMIN_CAREERS_PATH}
          variant="nav"
          className="inline-flex items-center gap-2 text-small"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {translate("back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading as="h1" size="1">
            {translate(job ? "editTitle" : "newTitle")}
          </Heading>
          {job !== null ? (
            <div className="flex flex-wrap items-start gap-3">
              {status !== "open" && !job.trashed ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={changing}
                  iconStart={<Icon icon={Rocket} size="sm" />}
                  onClick={() => void change("open")}
                >
                  {translate(status === "closed" ? "reopen" : "open")}
                </Button>
              ) : null}
              <JobClosePosting
                title={job.title}
                open={closing}
                onOpenChange={setClosing}
                onConfirm={() => void change("close")}
                loading={changing}
                disabled={!isOpen}
              />
            </div>
          ) : null}
        </div>
      </div>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-4xl flex-col gap-6"
      >
        <JobFormFields
          values={values}
          errors={errors}
          onChange={setValues}
          departments={departments}
          limits={LIMITS}
          open={isOpen}
          disabled={saving}
        />
        <ProjectSaveBar
          note={translate(job ? "saveNote.edit" : "saveNote.new")}
          words={{
            cancel: translate("cancel"),
            save: translate("save"),
            saving: translate("saving"),
          }}
          saving={saving}
          onCancel={() => router.push(ADMIN_CAREERS_PATH)}
          className="rounded-xl border"
        />
      </form>
    </div>
  );
}
