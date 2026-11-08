"use client";

import { useState, type ReactNode } from "react";
import {
  SubmissionDetail,
  type SubmissionDetailProps,
} from "@/components/domain/submission-detail";
import {
  SubmissionsFilters,
  type SubmissionsFilterBox,
} from "@/components/domain/submissions-filters";
import { SubmissionsTable, type SubmissionRow } from "@/components/domain/submissions-table";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Specimen, Stage } from "../frame";

/**
 * The admin's form submissions in their states (S7-T07, part B): the table, the filter boxes and the details of one
 * submission. Plain English text and made-up people; nothing here goes anywhere. The words come from the approved
 * admin-leads screen; the few that do not are listed in ADR-083 for the owner to confirm.
 */

const NOTHING = () => undefined;
const DASH = "—";

/* ── SubmissionsTable ─────────────────────────────────────────────── */

const COLUMNS = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  project: "Project",
  source: "Source",
  form: "Form",
  crm: "CRM",
  actions: "Actions",
};

type CrmState = "success" | "failed" | "pending" | "not_applicable";

function row(
  id: string,
  created: string,
  name: string,
  mobile: string | null,
  project: string,
  source: string,
  form: string,
  state: CrmState,
  crmId?: string,
): SubmissionRow {
  return {
    id,
    created,
    name,
    mobile: mobile ? { text: mobile, href: `tel:${mobile.replace(/\s+/g, "")}` } : null,
    project,
    source,
    form,
    crm: (
      <>
        <StatusBadge kind="crm" status={state} />
        {crmId ? <small className="text-caption text-muted">{crmId}</small> : null}
      </>
    ),
    openLabel: "Details",
    openFor: name,
    onOpen: NOTHING,
  };
}

const ROWS = [
  row(
    "1",
    "28 Oct, 11:02",
    "Priya Raman",
    "98400 12345",
    "Kadal Vista",
    "project_page",
    "Enquiry form",
    "success",
    "CRM-4821",
  ),
  row("2", "28 Oct, 10:31", "Anand V", "99620 11876", DASH, "contact_page", "Contact", "failed"),
  row(
    "3",
    "27 Oct, 20:44",
    "Meena S",
    "98410 70011",
    "Arivu Heights",
    "project_page",
    "Site visit",
    "success",
    "CRM-4817",
  ),
  row(
    "4",
    "27 Oct, 16:10",
    "Vikram R",
    "97101 30920",
    "Nila Grove",
    "project_page",
    "Enquiry form",
    "pending",
  ),
  row("5", "26 Oct, 09:00", DASH, null, DASH, DASH, "Newsletter", "not_applicable"),
];

const LONG_ROW = row(
  "6",
  "25 Oct, 08:00",
  "Venkatasubramanian Ramanathan Krishnamurthy",
  "98400 12345",
  "Sri Venkateswara Meenakshi Sundaram Signature Residences, Phase Two",
  "project_page",
  "Request a callback about the penthouse duplex in the north wing",
  "failed",
);

export function SubmissionsTableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The Form submissions tab: delivered (with the CRM's own id), failed, retrying and not sent; a dash for what was not given; Details on every row"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <div className="flex flex-col gap-4">
            <Heading as="h2" size="1">
              Leads
            </Heading>
            <Text tone="muted">Project leads and form submissions across the platform.</Text>
            <SubmissionsTable
              caption="Form submissions"
              columns={COLUMNS}
              rows={ROWS}
              noMobile={DASH}
              countText="5 submissions"
              note="Select Details to see the full submission."
            />
          </div>
        </Stage>
      </Specimen>
      <Specimen label="A very long name, project and form" className="w-full">
        <Stage tone="canvas" className="w-full">
          <SubmissionsTable
            caption="Form submissions"
            columns={COLUMNS}
            rows={[LONG_ROW]}
            noMobile={DASH}
            countText="1 submission"
          />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── SubmissionsFilters ───────────────────────────────────────────── */

const WORDS = {
  range: "Date range",
  form: "Form",
  project: "Project",
  source: "Source",
  crm: "CRM status",
  allForms: "All forms",
  allProjects: "All projects",
  allSources: "All sources",
  reset: "Reset",
};

const OPTIONS = {
  ranges: [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "all", label: "All time" },
  ],
  forms: [
    { value: "enquiry", label: "Enquiry form" },
    { value: "contact", label: "Contact" },
    { value: "visit", label: "Site visit" },
  ],
  projects: [
    { value: "vista", label: "Kadal Vista" },
    { value: "heights", label: "Arivu Heights" },
  ],
  sources: [
    { value: "project_page", label: "project_page" },
    { value: "contact_page", label: "contact_page" },
  ],
  crms: [
    { value: "any", label: "Any" },
    { value: "failed", label: "Failed" },
    { value: "pending", label: "Retrying" },
    { value: "success", label: "Delivered" },
    { value: "not_applicable", label: "Not sent" },
  ],
};

const NOTHING_CHOSEN: Record<SubmissionsFilterBox, string> = {
  range: "30",
  form: "",
  project: "",
  source: "",
  crm: "any",
};

function LiveFilters({ start }: { start: Record<SubmissionsFilterBox, string> }) {
  const [values, setValues] = useState(start);
  return (
    <SubmissionsFilters
      values={values}
      options={OPTIONS}
      words={WORDS}
      onChange={(box, value) => setValues((previous) => ({ ...previous, [box]: value }))}
      onReset={() => setValues(NOTHING_CHOSEN)}
    />
  );
}

export function SubmissionsFiltersDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Nothing chosen but the last 30 days (try the boxes; Reset puts them back)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <LiveFilters start={NOTHING_CHOSEN} />
        </Stage>
      </Specimen>
      <Specimen
        label="Some chosen: a form, a project and only the failed deliveries"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <LiveFilters
            start={{ range: "7", form: "enquiry", project: "vista", source: "", crm: "failed" }}
          />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── SubmissionDetail ─────────────────────────────────────────────── */

const DETAIL_WORDS = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  email: "Email",
  form: "Form",
  project: "Project",
  source: "Source",
  answers: "Answers",
  crm: "CRM",
  crmId: "CRM id",
};

const FAILED: SubmissionDetailProps = {
  details: {
    created: "28 Oct 2026, 10:31",
    name: "Anand V",
    mobile: { text: "99620 11876", href: "tel:9962011876" },
    email: DASH,
    form: "Contact",
    project: DASH,
    source: "contact_page",
  },
  noMobile: DASH,
  answers: [
    {
      id: "message",
      label: "Message",
      value: "I would like to speak about listing my plot in Medavakkam.",
    },
  ],
  crm: { badge: <StatusBadge kind="crm" status="failed" /> },
  failure: {
    title: "CRM delivery failed",
    text: "HTTP 502 on attempt 2. The next automatic retry is in 30 minutes.",
  },
  words: DETAIL_WORDS,
};

const DELIVERED: SubmissionDetailProps = {
  details: {
    created: "28 Oct 2026, 11:02",
    name: "Priya Raman",
    mobile: { text: "98400 12345", href: "tel:9840012345" },
    email: "priya.raman@example.com",
    form: "Enquiry form",
    project: "Kadal Vista",
    source: "project_page",
  },
  noMobile: DASH,
  answers: [
    { id: "budget", label: "Budget", value: "₹1 Cr" },
    { id: "wants", label: "What they want", value: "Parking, Gym, Clubhouse" },
    {
      id: "message",
      label:
        "Is there anything else you would like us to know before we call you back about the project?",
      value:
        "Please call after 6 pm on weekdays. We are looking for a third-floor east-facing 3 BHK with two car parks, and a loan tie-up with a bank would help a great deal.",
    },
  ],
  crm: { badge: <StatusBadge kind="crm" status="success" />, leadId: "CRM-4821" },
  words: DETAIL_WORDS,
};

const BARE: SubmissionDetailProps = {
  details: {
    created: "26 Oct 2026, 09:00",
    name: DASH,
    mobile: null,
    email: DASH,
    form: "Newsletter",
    project: DASH,
    source: DASH,
  },
  noMobile: DASH,
  answers: [],
  crm: { badge: <StatusBadge kind="crm" status="not_applicable" /> },
  words: DETAIL_WORDS,
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-135 rounded-xl border border-line bg-surface p-6">{children}</div>
  );
}

function DetailOpener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        Open: Submission details
      </Button>
      <ManagerDrawer
        open={open}
        onOpenChange={setOpen}
        title="Submission details"
        closeLabel="Close"
        cancelLabel="Close"
      >
        <SubmissionDetail {...FAILED} />
      </ManagerDrawer>
    </>
  );
}

export function SubmissionDetailDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="A failed delivery: the reason and when it will be tried again">
        <Card>
          <SubmissionDetail {...FAILED} />
        </Card>
      </Specimen>
      <Specimen label="A delivered submission with three answers, one with a very long question and answer">
        <Card>
          <SubmissionDetail {...DELIVERED} />
        </Card>
      </Specimen>
      <Specimen label="A submission with almost nothing in it: no answers, no mobile, not sent to a CRM">
        <Card>
          <SubmissionDetail {...BARE} />
        </Card>
      </Specimen>
      <Specimen label="The drawer it opens in (try it)">
        <DetailOpener />
      </Specimen>
    </div>
  );
}
