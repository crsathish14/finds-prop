"use client";

import { useState } from "react";
import { JobClosePosting } from "@/components/domain/job-close-posting";
import {
  JobFormFields,
  type JobFormErrors,
  type JobFormValues,
} from "@/components/domain/job-form-fields";
import {
  JobManager,
  type JobManagerProps,
  type JobRow,
  type JobStep,
  type JobTab,
} from "@/components/domain/job-manager";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The Careers admin's parts (ADR-143 section 5): the list of jobs, the editor's boxes with the shared save bar, and the
 * Close posting button with its question. Made-up jobs; nothing here goes anywhere. The words the parts say come from
 * en.json and are draft wording for the owner to approve.
 */

const NOTHING = () => undefined;

/* The list */

type Sample = {
  id: string;
  title: string;
  department: string;
  location: string;
  status: "draft" | "open" | "closed";
  expired?: boolean;
  trashed?: boolean;
  closes: string | null;
  updated: string;
};

const SAMPLES: Sample[] = [
  {
    id: "a",
    title: "Site Engineer",
    department: "Engineering",
    location: "Chennai",
    status: "open",
    closes: "31 Dec 2026",
    updated: "20 Nov 2026",
  },
  {
    id: "b",
    title: "Sales Executive",
    department: "Sales",
    location: "Madurai",
    status: "open",
    expired: true,
    closes: "15 Nov 2026",
    updated: "18 Nov 2026",
  },
  {
    id: "c",
    title: "Office Assistant",
    department: "Operations",
    location: "Coimbatore",
    status: "draft",
    closes: null,
    updated: "17 Nov 2026",
  },
  {
    id: "d",
    title:
      "Senior Regional Manager for Residential Projects Across Tamil Nadu and Neighbouring States",
    department: "Operations and a very long department name",
    location: "Supercalifragilisticexpialidocious-Nagar-0123456789",
    status: "closed",
    closes: "1 Oct 2026",
    updated: "2 Oct 2026",
  },
];

function stepFor(sample: Sample, trash: boolean): JobStep {
  if (trash) return "restore";
  if (sample.status === "open") return sample.expired ? "reopen" : "close";
  return sample.status === "closed" ? "reopen" : "open";
}

function rowsFor(samples: Sample[], trash = false): JobRow[] {
  return samples.map((sample) => ({
    id: sample.id,
    title: sample.title,
    departmentName: sample.department,
    location: sample.location,
    status: sample.status,
    ...(trash ? { trashed: true } : {}),
    ...(sample.expired ? { expired: true } : {}),
    updated: sample.updated,
    closes: sample.closes,
    editHref: `#edit-${sample.id}`,
    step: { kind: stepFor(sample, trash), onClick: NOTHING },
    ...(trash ? {} : { trash: { onClick: NOTHING } }),
  }));
}

function managerProps(overrides: Partial<JobManagerProps> = {}): JobManagerProps {
  return {
    addHref: "#new-job",
    onDepartments: NOTHING,
    headingLevel: "h2",
    tabs: {
      options: [
        { value: "all", count: 4 },
        { value: "open", count: 2 },
        { value: "draft", count: 1 },
        { value: "closed", count: 1 },
        { value: "trash", count: 2 },
      ],
      value: "all",
      onChange: NOTHING,
    },
    department: {
      options: [
        { value: "engineering", label: "Engineering" },
        { value: "sales", label: "Sales" },
        { value: "operations", label: "Operations" },
      ],
      value: "",
      onChange: NOTHING,
    },
    search: { value: "", onChange: NOTHING },
    caption: "Jobs",
    rows: rowsFor(SAMPLES),
    countText: "4 of 4 jobs",
    ...overrides,
  };
}

function ListTryIt() {
  const [tab, setTab] = useState<JobTab>("all");
  const [department, setDepartment] = useState("");
  const [query, setQuery] = useState("");
  const visible = SAMPLES.filter(
    (sample) =>
      (tab === "all" || tab === "trash" || sample.status === tab) &&
      (department === "" || sample.department.toLowerCase() === department) &&
      sample.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const base = managerProps();
  return (
    <JobManager
      {...base}
      tabs={{ ...base.tabs, value: tab, onChange: setTab }}
      department={{ ...base.department, value: department, onChange: setDepartment }}
      search={{ value: query, onChange: setQuery }}
      rows={tab === "trash" ? [] : rowsFor(visible)}
      countText={`${visible.length} of 4 jobs`}
    />
  );
}

export function JobManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The admin&apos;s list of jobs (ADR-143): tabs for All, Open, Drafts, Closed and Trash, a
        department filter, a search, a table that becomes cards on a phone, and on each row Edit,
        Open or Close posting or Reopen, and Move to Trash. An open job whose closing date has
        passed says Expired. Trash is reversible: a restored job comes back closed, never open.
        Made-up jobs.
      </Text>
      <Specimen label="Try it: switch the tab, choose a department, type in the search">
        <div className="w-full max-w-6xl">
          <ListTryIt />
        </div>
      </Specimen>
      <Specimen label="The Trash tab: Restore, no Edit">
        <div className="w-full max-w-6xl">
          <JobManager
            {...managerProps({
              tabs: { ...managerProps().tabs, value: "trash" },
              rows: rowsFor(SAMPLES.slice(2, 3), true),
              countText: "1 of 2 jobs in the Trash",
            })}
          />
        </div>
      </Specimen>
      <Specimen label="A list being changed (every row button is off)">
        <div className="w-full max-w-6xl">
          <JobManager {...managerProps({ rows: rowsFor(SAMPLES.slice(0, 2)), pending: true })} />
        </div>
      </Specimen>
      <Specimen label="Nothing yet, and no match for a search">
        <div className="flex w-full max-w-6xl flex-col gap-10">
          <JobManager {...managerProps({ rows: [], countText: "0 jobs" })} />
          <JobManager
            {...managerProps({
              rows: [],
              search: { value: "zzzz", onChange: NOTHING },
              countText: "0 jobs",
            })}
          />
        </div>
      </Specimen>
    </div>
  );
}

/* The edit form */

const EMPTY: JobFormValues = {
  title: "",
  slug: "",
  departmentId: "",
  location: "",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "",
  summary: "",
  description: "",
  responsibilities: "",
  requirements: "",
  salaryNote: "",
  applyKind: "link",
  applyUrl: "",
  applyEmail: "",
  closesAt: "",
};

const FILLED: JobFormValues = {
  title: "Site Engineer",
  slug: "site-engineer",
  departmentId: "engineering",
  location: "Chennai",
  workMode: "hybrid",
  employmentType: "full_time",
  experience: "2 to 4 years",
  summary: "Supervise our building sites and keep every project on schedule.",
  description:
    "You will supervise the construction of apartments and villas from the first foundation to the handover.\n\nYou report to the project head.",
  responsibilities: "Visit each site every day\nWrite a weekly progress report",
  requirements: "A civil engineering degree or diploma\nTwo years of site experience",
  salaryNote: "4 to 6 lakh a year",
  applyKind: "email",
  applyUrl: "",
  applyEmail: "careers@example.test",
  closesAt: "2026-12-31T18:00",
};

const DEPARTMENTS = [
  { value: "engineering", label: "Engineering" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
];

const LIMITS = {
  title: 160,
  location: 120,
  experience: 80,
  summary: 320,
  description: 8000,
  responsibilities: 4000,
  requirements: 4000,
  salaryNote: 120,
};

function FormSpecimen({
  initial,
  errors,
  departments = DEPARTMENTS,
  saving = false,
  open = false,
  note = "Saving changes the site at once if the job is open.",
}: {
  initial: JobFormValues;
  errors?: JobFormErrors;
  departments?: typeof DEPARTMENTS;
  saving?: boolean;
  open?: boolean;
  note?: string;
}) {
  const [values, setValues] = useState(initial);
  return (
    <form
      noValidate
      onSubmit={(event) => event.preventDefault()}
      className="flex w-full max-w-3xl flex-col gap-6"
    >
      <JobFormFields
        values={values}
        onChange={setValues}
        departments={departments}
        limits={LIMITS}
        open={open}
        disabled={saving}
        {...(errors ? { errors } : {})}
      />
      <ProjectSaveBar
        note={note}
        words={{ cancel: "Cancel", save: "Save job", saving: "Saving" }}
        saving={saving}
        sticky={false}
        onCancel={NOTHING}
        className="rounded-xl border"
      />
    </form>
  );
}

export function JobFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The boxes of the admin&apos;s job page (ADR-143), in four sections: Basics, About the job,
        How to apply (a link or an email, never both) and the Closing date, above the save bar the
        project form uses. Opening and closing the job are buttons of the page, not boxes. Wording
        is draft wording for the owner to approve.
      </Text>
      <Specimen label="A new job: empty (try typing: the counters follow, and the apply box changes with the choice)">
        <FormSpecimen initial={EMPTY} note="A new job is saved as a draft until you open it." />
      </Specimen>
      <Specimen label="An open job being edited, with an email to apply to (the address note warns)">
        <FormSpecimen initial={FILLED} open />
      </Specimen>
      <Specimen label="Problems on the boxes">
        <FormSpecimen
          initial={{ ...EMPTY, title: "QA", applyUrl: "http://example.test" }}
          errors={{
            title: "Use at least 3 characters.",
            departmentId: "Choose a department.",
            location: "This field is required.",
            applyUrl: "Enter a full link that starts with https://.",
            closesAt: "The closing date is already past. Choose a later date or clear it.",
          }}
        />
      </Specimen>
      <Specimen label="Saving (every box is off) and no department yet">
        <div className="flex w-full flex-col gap-10">
          <FormSpecimen initial={FILLED} saving />
          <FormSpecimen initial={EMPTY} departments={[]} />
        </div>
      </Specimen>
    </div>
  );
}

/* Close posting */

function CloseTryIt({
  disabled = false,
  startOpen = false,
}: {
  disabled?: boolean;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [loading, setLoading] = useState(false);
  return (
    <JobClosePosting
      title="Site Engineer"
      open={open}
      onOpenChange={setOpen}
      loading={loading}
      disabled={disabled}
      onConfirm={() => {
        setLoading(true);
        window.setTimeout(() => {
          setLoading(false);
          setOpen(false);
        }, 900);
      }}
    />
  );
}

export function JobClosePostingDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The Close posting button of the job editor and the question it asks first (ADR-143 section
        5). Closing takes the job off the site at once; it stays in the list as Closed and can be
        opened again. The question puts focus on Keep it open, so Enter never closes a posting by
        accident. Wording is draft wording for the owner to approve.
      </Text>
      <Specimen label="Try it: choose Close posting, then Close posting again (it works for a moment)">
        <CloseTryIt />
      </Specimen>
      <Specimen label="The job is not open: the button is off and says why">
        <CloseTryIt disabled />
      </Specimen>
    </div>
  );
}
