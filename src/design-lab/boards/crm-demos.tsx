"use client";

import { useState, type ReactNode } from "react";
import {
  CrmConnectionFields,
  CrmCredentialField,
  type CrmConnectionBox,
  type CrmConnectionValues,
  type CrmCredentialMode,
} from "@/components/domain/crm-connection-fields";
import {
  CrmConnectionCards,
  CrmPageHeader,
  type CrmConnectionView,
} from "@/components/domain/crm-connections";
import { CrmLogsTable, type CrmLogRow } from "@/components/domain/crm-logs-table";
import { CrmRowsEditor, type CrmRow } from "@/components/domain/crm-rows-editor";
import { SubmissionDetail } from "@/components/domain/submission-detail";
import { SubmissionsTable, type SubmissionRow } from "@/components/domain/submissions-table";
import { Alert } from "@/components/patterns/alert";
import { FormSection } from "@/components/patterns/form-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Badge } from "@/components/ui/badge";
import { Specimen, Stage } from "../frame";

/**
 * The admin's CRM page in its states (S7-T09, part C): the connection cards, the API logs, the editor's boxes and rows,
 * and the two additions to the Leads page (the Agent column and Retry delivery now). Plain English text and made-up
 * names; nothing here goes anywhere. The words come from the approved admin-crm and admin-leads screens; the few that do
 * not are listed in ADR-117 for the owner to confirm.
 */

const NOTHING = () => undefined;

/* ── Connection cards ─────────────────────────────────────────────── */

const WORDS = {
  endpoint: "Endpoint",
  secretSet: "Set",
  secretNotSet: "Not set",
  secretsNote: "Secret values are stored on the server and are never shown again.",
};

const EMPTY = {
  title: "No connections yet",
  text: "Add a CRM connection to send form submissions to it.",
  action: { label: "New connection", href: "#" },
};

function connection(
  change: Partial<CrmConnectionView> & { id: string; name: string },
): CrmConnectionView {
  return {
    state: { label: "Active", active: true },
    endpoint: "POST https://api.crm.example/v2/leads",
    secrets: [
      { label: "API key", set: true },
      { label: "API secret", set: false },
      { label: "Access token", set: true },
    ],
    test: { label: "Test API", onClick: NOTHING },
    edit: { href: "#", label: "Edit", forName: change.name },
    remove: { label: `Delete ${change.name}`, onClick: NOTHING },
    ...change,
  };
}

const SAMPLE = connection({ id: "sample", name: "Sample CRM" });
const BACKUP = connection({
  id: "backup",
  name: "Backup CRM",
  state: { label: "Inactive", active: false },
  endpoint: "POST https://hooks.backup.example/lead",
  secrets: [],
  test: { label: "Test API", onClick: NOTHING, disabled: true },
});

function Page({ connections, notice }: { connections: CrmConnectionView[]; notice?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <CrmPageHeader
        title="CRM integrations"
        headingLevel="h2"
        intro="Send form submissions to your CRM, and see what was delivered."
        action={{ label: "New connection", href: "#" }}
      />
      <Tabs value="connections">
        <TabsList aria-label="CRM sections">
          <TabsTrigger value="connections" count={connections.length}>
            Connections
          </TabsTrigger>
          <TabsTrigger value="logs" count="1 failed" countTone="new">
            API logs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="pt-4">
          <CrmConnectionCards
            connections={connections}
            words={WORDS}
            empty={EMPTY}
            {...(notice ? { notice } : {})}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CrmConnectionCardsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Two connections, and a test that worked" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Page
            connections={[SAMPLE, BACKUP]}
            notice={
              <Alert tone="success" title="Test succeeded">
                Sample CRM answered with HTTP 200 in 412 ms. A test lead was logged.
              </Alert>
            }
          />
        </Stage>
      </Specimen>
      <Specimen label="A test that failed" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Page
            connections={[SAMPLE]}
            notice={
              <Alert tone="danger" title="Test failed">
                Sample CRM answered with HTTP 401. Check the API key, then test again.
              </Alert>
            }
          />
        </Stage>
      </Specimen>
      <Specimen label="A test running, and a very long name and address" className="w-full">
        <Stage tone="canvas" className="w-full">
          <CrmConnectionCards
            connections={[
              connection({
                id: "long",
                name: "The regional sales team's CRM for the Chennai office, second account",
                endpoint:
                  "PUT https://leads.regional-sales-team.chennai.example/api/v3/accounts/second/leads/incoming",
                test: { label: "Test API", onClick: NOTHING, pending: true },
              }),
            ]}
            words={WORDS}
            empty={EMPTY}
          />
        </Stage>
      </Specimen>
      <Specimen label="Nothing yet" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Page connections={[]} />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── API logs ─────────────────────────────────────────────────────── */

const LOG_COLUMNS = {
  time: "Time",
  crm: "CRM",
  form: "Form",
  status: "Status",
  http: "HTTP",
  attempt: "Attempt",
  response: "Response",
  actions: "Actions",
};

const SUCCESS = (
  <Badge dot tone="success">
    Success
  </Badge>
);
const FAILED = (
  <Badge dot tone="danger">
    Failed
  </Badge>
);

const LOG_ROWS: CrmLogRow[] = [
  {
    id: "1",
    time: "28 Oct, 11:02",
    crm: "Sample CRM",
    form: "Enquiry form",
    status: SUCCESS,
    http: "200",
    attempt: "1",
    response: '{"ok":true,"lead_id":"CRM-4821"}',
  },
  {
    id: "2",
    time: "28 Oct, 10:31",
    crm: "Sample CRM",
    form: "Contact",
    status: FAILED,
    http: "502",
    attempt: "2",
    response: "Bad gateway: upstream timed out",
    retry: { label: "Retry", forName: "Sample CRM, 28 Oct, 10:31", onClick: NOTHING },
  },
  {
    id: "3",
    time: "27 Oct, 20:44",
    crm: "Sample CRM",
    form: "Kadal Vista site visit",
    status: SUCCESS,
    http: "200",
    attempt: "1",
    response: '{"ok":true,"lead_id":"CRM-4817"}',
  },
];

const LOG_PROPS = {
  caption: "API logs",
  columns: LOG_COLUMNS,
  note: "Failed deliveries retry automatically after 1, 5, 30, 120 and 720 minutes, up to 6 attempts.",
  empty: {
    title: "No deliveries yet",
    text: "Calls to your CRMs show here, newest first.",
  },
};

export function CrmLogsTableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Three deliveries, one failed with Retry" className="w-full">
        <Stage tone="canvas" className="w-full">
          <CrmLogsTable {...LOG_PROPS} rows={LOG_ROWS} countText="3 deliveries" />
        </Stage>
      </Specimen>
      <Specimen
        label="A retry running, a call that got no answer, an older failure with no Retry, a test call, and a very long answer"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <CrmLogsTable
            {...LOG_PROPS}
            countText="5 deliveries"
            rows={[
              {
                ...(LOG_ROWS[1] as CrmLogRow),
                id: "a",
                retry: {
                  label: "Retry",
                  forName: "Sample CRM, 28 Oct, 10:31",
                  onClick: NOTHING,
                  pending: true,
                },
              },
              {
                id: "b",
                time: "28 Oct, 10:30",
                crm: "Sample CRM",
                form: "Contact",
                status: FAILED,
                http: "—",
                attempt: "1",
                response: "The CRM did not answer in time.",
                retry: { label: "Retry", forName: "Sample CRM, 28 Oct, 10:30", onClick: NOTHING },
              },
              {
                id: "c",
                time: "28 Oct, 10:29",
                crm: "Sample CRM",
                form: "Contact",
                status: FAILED,
                http: "500",
                attempt: "1",
                response: "Internal server error",
              },
              {
                id: "d",
                time: "28 Oct, 09:12",
                crm: "Sample CRM",
                form: "Connection test",
                status: SUCCESS,
                http: "200",
                attempt: "1",
                response: '{"ok":true}',
              },
              {
                id: "e",
                time: "27 Oct, 18:03",
                crm: "Backup CRM with a longer name than the column has room for",
                form: "Kadal Vista enquiry",
                status: FAILED,
                http: "400",
                attempt: "6",
                response:
                  '{"error":"validation_failed","details":[{"field":"phone","message":"must be a 10 digit number without spaces or a country code"}],"request":"9f8c2a"}…',
              },
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen label="Nothing yet" className="w-full">
        <Stage tone="canvas" className="w-full">
          <CrmLogsTable {...LOG_PROPS} rows={[]} countText="0 deliveries" />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── Editor: Connection and Credentials ───────────────────────────── */

const CONNECTION_WORDS = {
  name: "Name",
  leadSource: "Lead source",
  baseUrl: "Base URL",
  baseUrlHint:
    "Use an https address on a public domain. Local and private addresses aren't allowed.",
  endpoint: "Endpoint",
  method: "HTTP method",
  leadIdPath: "Lead ID path",
  status: "Status",
  active: "Active",
};

const METHODS = [
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
];

const SAMPLE_VALUES: CrmConnectionValues = {
  name: "Sample CRM",
  leadSource: "Find Prop website",
  baseUrl: "https://api.crm.example",
  endpoint: "/v2/leads",
  method: "POST",
  leadIdPath: "data.lead.id",
  active: true,
};

function Connection({
  start,
  errors,
  disabled,
}: {
  start: CrmConnectionValues;
  errors?: Partial<Record<CrmConnectionBox, string>>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(start);
  return (
    <FormSection id="connection" title="Connection">
      <CrmConnectionFields
        values={values}
        {...(errors ? { errors } : {})}
        {...(disabled ? { disabled } : {})}
        onChange={(box, value) => setValues((previous) => ({ ...previous, [box]: value }))}
        methods={METHODS}
        words={CONNECTION_WORDS}
      />
    </FormSection>
  );
}

const CREDENTIAL_WORDS = {
  replace: "Replace",
  clear: "Clear",
  undo: "Undo",
  cancel: "Cancel",
  notSet: "Not set",
  willClear: "Will be removed when you save.",
};

function Credential({
  label,
  stored,
  start = "keep",
  error,
  disabled,
}: {
  label: string;
  stored: boolean;
  start?: CrmCredentialMode;
  error?: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<CrmCredentialMode>(start);
  const [value, setValue] = useState(start === "replace" ? "new-key-value" : "");
  return (
    <CrmCredentialField
      label={label}
      stored={stored}
      mode={mode}
      value={value}
      onModeChange={setMode}
      onValueChange={setValue}
      error={error}
      disabled={disabled ?? false}
      words={CREDENTIAL_WORDS}
    />
  );
}

export function CrmConnectionFieldsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Connection box, filled in for Sample CRM">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Connection start={SAMPLE_VALUES} />
        </Stage>
      </Specimen>
      <Specimen label="An address that is not allowed">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Connection
            start={{ ...SAMPLE_VALUES, baseUrl: "http://localhost:8080" }}
            errors={{ baseUrl: "Must be https and a public address." }}
          />
        </Stage>
      </Specimen>
      <Specimen label="Saving (everything is off)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Connection start={SAMPLE_VALUES} disabled />
        </Stage>
      </Specimen>
      <Specimen label="The Credentials box: a saved key, a secret with nothing saved, and a saved token (try Replace and Clear)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <FormSection
            id="credentials"
            title="Credentials"
            description="Stored on the server only. Leave a field alone to keep the saved value."
          >
            <div className="flex flex-col gap-4">
              <Credential label="API key" stored />
              <Credential label="API secret" stored={false} />
              <Credential label="Access token" stored />
            </div>
          </FormSection>
        </Stage>
      </Specimen>
      <Specimen label="A secret being replaced, a secret to be cleared, a secret with an error, and saving">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <div className="flex flex-col gap-4">
            <Credential label="API key" stored start="replace" />
            <Credential label="API secret" stored start="clear" />
            <Credential label="Access token" stored={false} error="This value is not valid." />
            <Credential label="API key (saving)" stored disabled />
          </div>
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── Editor: headers, body mapping, project codes ─────────────────── */

type Seed = { id: string; first: string; second: string };

function Rows({
  heading,
  note,
  start,
  firstLabel,
  secondLabel,
  removeWord,
  addLabel,
  empty,
  choices,
  errors = {},
  disabled,
}: {
  heading: string;
  note?: string;
  start: Seed[];
  firstLabel: string;
  secondLabel: string;
  removeWord: string;
  addLabel: string;
  empty: string;
  choices?: { value: string; label: string }[];
  errors?: Record<string, { first?: string; second?: string }>;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState(start);
  const view: CrmRow[] = rows.map((row) => ({
    ...row,
    firstError: errors[row.id]?.first,
    secondError: errors[row.id]?.second,
    removeLabel: `${removeWord} ${row.first || firstLabel}`,
  }));
  return (
    <CrmRowsEditor
      heading={heading}
      {...(note ? { note } : {})}
      rows={view}
      firstLabel={firstLabel}
      secondLabel={secondLabel}
      {...(choices ? { firstChoices: choices, choose: "Choose a project" } : {})}
      onChange={(id, side, value) =>
        setRows((previous) =>
          previous.map((row) => (row.id === id ? { ...row, [side]: value } : row)),
        )
      }
      onAdd={() =>
        setRows((previous) => [
          ...previous,
          { id: `new-${previous.length}`, first: "", second: "" },
        ])
      }
      onRemove={(id) => setRows((previous) => previous.filter((row) => row.id !== id))}
      addLabel={addLabel}
      empty={empty}
      disabled={disabled ?? false}
    />
  );
}

const PROJECT_CHOICES = [
  { value: "vista", label: "Kadal Vista" },
  { value: "courts", label: "Kadal Courts" },
];

const HEADERS: Seed[] = [{ id: "h1", first: "X-Source", second: "findprop" }];
const BODY: Seed[] = [
  { id: "b1", first: "full_name", second: "{{name}}" },
  { id: "b2", first: "phone", second: "{{mobile}}" },
];

const HEADER_PROPS = {
  heading: "Headers",
  firstLabel: "Header name",
  secondLabel: "Header value",
  removeWord: "Remove header",
  addLabel: "Add header",
  empty: "No headers.",
};
const BODY_PROPS = {
  heading: "Body mapping",
  note: "(use {{field_key}} from the form)",
  firstLabel: "CRM field",
  secondLabel: "Template",
  removeWord: "Remove mapping",
  addLabel: "Add mapping",
  empty: "No mapping.",
};
const CODE_PROPS = {
  heading: "Project codes",
  firstLabel: "Project",
  secondLabel: "CRM code",
  removeWord: "Remove code",
  addLabel: "Add code",
  empty: "No codes.",
};

export function CrmRowsEditorDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Headers and body box: headers, body mapping and project codes (try Add and Remove)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <FormSection id="headers-body" title="Headers and body">
            <div className="flex flex-col gap-6">
              <Rows {...HEADER_PROPS} start={HEADERS} />
              <Rows {...BODY_PROPS} start={BODY} />
              <Rows
                {...CODE_PROPS}
                start={[{ id: "c1", first: "vista", second: "KV-01" }]}
                choices={PROJECT_CHOICES}
              />
            </div>
          </FormSection>
        </Stage>
      </Specimen>
      <Specimen label="Nothing added yet in each list">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <div className="flex flex-col gap-6">
            <Rows {...HEADER_PROPS} start={[]} />
            <Rows {...BODY_PROPS} start={[]} />
            <Rows {...CODE_PROPS} start={[]} choices={PROJECT_CHOICES} />
          </div>
        </Stage>
      </Specimen>
      <Specimen label="A repeated name and a value with an error, and saving (everything is off)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <div className="flex flex-col gap-6">
            <Rows
              {...HEADER_PROPS}
              start={[
                { id: "h1", first: "X-Source", second: "findprop" },
                { id: "h2", first: "x-source", second: "again" },
              ]}
              errors={{ h2: { first: "Another row already uses this name." } }}
            />
            <Rows
              {...BODY_PROPS}
              start={[{ id: "b1", first: "phone", second: "" }]}
              errors={{ b1: { second: "This field is required." } }}
            />
            <Rows {...HEADER_PROPS} heading="Headers (saving)" start={HEADERS} disabled />
          </div>
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── Leads page: the Agent column and Retry delivery now ──────────── */

const SUBMISSION_COLUMNS = {
  created: "Created",
  name: "Name",
  mobile: "Mobile",
  project: "Project",
  source: "Source",
  form: "Form",
  agent: "Agent",
  crm: "CRM",
  actions: "Actions",
};

function submission(
  id: string,
  created: string,
  name: string,
  form: string,
  agent: string,
  badge: ReactNode,
): SubmissionRow {
  return {
    id,
    created,
    name,
    mobile: { text: "98400 12345", href: "tel:+919840012345" },
    project: "Kadal Vista",
    source: "project_page",
    form,
    agent,
    crm: badge,
    openLabel: "Details",
    openFor: name,
    onOpen: NOTHING,
  };
}

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

const DETAIL = {
  details: {
    created: "28 Oct, 10:31",
    name: "Anand V",
    mobile: { text: "99620 11876", href: "tel:+919962011876" },
    email: "anand@example.com",
    form: "Contact",
    project: "—",
    source: "contact_page",
  },
  noMobile: "—",
  answers: [{ id: "message", label: "Message", value: "Please call me about 3 BHK homes on OMR." }],
  crm: {
    badge: (
      <Badge dot tone="danger">
        Failed
      </Badge>
    ),
  },
  failure: {
    title: "CRM delivery failed",
    text: "HTTP 502 on attempt 2. The next automatic retry is in 30 minutes.",
  },
  words: DETAIL_WORDS,
};

export function CrmSubmissionPartsDemo() {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Form submissions list with the Agent column" className="w-full">
        <Stage tone="canvas" className="w-full">
          <SubmissionsTable
            caption="Form submissions"
            columns={SUBMISSION_COLUMNS}
            noMobile="—"
            countText="3 submissions"
            note="Select Details to see the full submission."
            rows={[
              submission(
                "1",
                "28 Oct, 11:02",
                "Priya Raman",
                "Enquiry form",
                "Sales team",
                <Badge dot tone="success">
                  Delivered
                </Badge>,
              ),
              submission(
                "2",
                "28 Oct, 10:31",
                "Anand V",
                "Contact",
                "—",
                <Badge dot tone="danger">
                  Failed
                </Badge>,
              ),
              submission(
                "3",
                "27 Oct, 16:10",
                "Vikram R",
                "Enquiry form",
                "Sales team",
                <Badge dot tone="warning">
                  Retrying
                </Badge>,
              ),
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen label="A failed delivery with Retry delivery now (press it to see it working)">
        <Stage tone="surface" className="w-full max-w-md">
          <SubmissionDetail
            {...DETAIL}
            retry={{
              label: "Retry delivery now",
              pending: retrying,
              onClick: () => setRetrying(true),
            }}
          />
        </Stage>
      </Specimen>
      <Specimen label="A failed delivery that cannot be retried (no button), and one while it retries">
        <div className="flex w-full flex-wrap items-start gap-8">
          <Stage tone="surface" className="w-full max-w-md">
            <SubmissionDetail {...DETAIL} />
          </Stage>
          <Stage tone="surface" className="w-full max-w-md">
            <SubmissionDetail
              {...DETAIL}
              retry={{ label: "Retry delivery now", pending: true, onClick: NOTHING }}
            />
          </Stage>
        </div>
      </Specimen>
    </div>
  );
}
