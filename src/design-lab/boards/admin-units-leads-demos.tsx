"use client";

import { TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LeadsTable, type LeadRow } from "@/components/domain/leads-table";
import { UnitForm, type UnitFormValues, type UnitFormWords } from "@/components/domain/unit-form";
import { UnitsManager, type UnitRow } from "@/components/domain/units-manager";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Specimen, Stage } from "../frame";

/**
 * The Units page and the Leads table in their states (S7-T01, part 2): Plain English text; nothing here goes anywhere.
 * The words come from the approved admin-units, builder-units, admin-leads and builder-leads screens; the few that do
 * not are listed in ADR-079 for the owner to confirm.
 */

const NOTHING = () => undefined;

/* ── UnitForm ────────────────────────────────────────────────────── */

const WORDS: UnitFormWords = {
  unitNumber: "Unit number",
  floor: "Floor",
  bhk: "BHK",
  area: "Area (sq.ft)",
  facing: "Facing",
  price: "Price (₹)",
  status: "Status",
  availableFrom: "Available from",
  floorPlanUrl: "Floor plan link",
  optional: "(optional)",
  notSet: "Not set",
  bhkOptions: ["1", "2", "3", "4", "5", "6"].map((value) => ({ value, label: value })),
  facingOptions: ["East", "North", "West", "South"].map((value) => ({
    value: value.toLowerCase(),
    label: value,
  })),
  statusOptions: [
    { value: "available", label: "Available" },
    { value: "hold", label: "On hold" },
    { value: "sold", label: "Sold" },
    { value: "blocked", label: "Blocked" },
  ],
};

const EMPTY: UnitFormValues = {
  unitNumber: "",
  floor: "",
  bhk: "",
  area: "",
  facing: "",
  price: "",
  status: "available",
  availableFrom: "",
  floorPlanUrl: "",
};

const FILLED: UnitFormValues = {
  unitNumber: "B-303",
  floor: "3",
  bhk: "3",
  area: "1480",
  facing: "west",
  price: "11800000",
  status: "available",
  availableFrom: "2026-12-01",
  floorPlanUrl: "https://kadalhomes.example/plans/b-303.pdf",
};

function LiveForm({
  initial,
  errors,
  disabled,
}: {
  initial: UnitFormValues;
  errors?: Partial<Record<keyof UnitFormValues, string>>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <UnitForm
      id="lab-unit-form-specimen"
      values={values}
      {...(errors ? { errors } : {})}
      {...(disabled ? { disabled } : {})}
      onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
      onSubmit={NOTHING}
      words={WORDS}
    />
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-135 rounded-xl border border-line bg-surface p-6">{children}</div>
  );
}

export function UnitFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Add unit: empty">
        <Card>
          <LiveForm initial={EMPTY} />
        </Card>
      </Specimen>
      <Specimen label="Add unit: no unit number, a price that is not a number and a link that is not an address">
        <Card>
          <LiveForm
            initial={{ ...EMPTY, price: "ten", floorPlanUrl: "kadalhomes" }}
            errors={{
              unitNumber: "Enter a unit number.",
              price: "Enter the price in rupees, in numbers.",
              floorPlanUrl: "Enter a full address, starting with https://",
            }}
          />
        </Card>
      </Specimen>
      <Specimen label="Edit unit: filled in">
        <Card>
          <LiveForm initial={FILLED} />
        </Card>
      </Specimen>
      <Specimen label="Saving the unit: every box is off">
        <Card>
          <LiveForm initial={FILLED} disabled />
        </Card>
      </Specimen>
    </div>
  );
}

/* ── UnitsManager ────────────────────────────────────────────────── */

const COLUMNS = {
  unit: "Unit",
  floor: "Floor",
  bhk: "BHK",
  area: "Area",
  facing: "Facing",
  price: "Price",
  status: "Status",
  actions: "Actions",
};

type UnitState = "available" | "onHold" | "sold" | "blocked";

function unit(
  number: string,
  floor: string,
  bhk: string,
  area: string,
  facing: string,
  price: string,
  state: UnitState,
  pending = false,
): UnitRow {
  return {
    id: number,
    unitNumber: number,
    floor,
    bhk,
    area,
    facing,
    price,
    status: <StatusBadge kind="unit" status={state} />,
    editLabel: "Edit",
    editFor: `unit ${number}`,
    onEdit: NOTHING,
    deleteLabel: `Delete unit ${number}`,
    onDelete: NOTHING,
    pending,
  };
}

const UNITS = [
  unit("A-101", "1", "2", "1,050 sq.ft", "East", "₹78 L", "available"),
  unit("A-102", "1", "3", "1,450 sq.ft", "North", "₹1.12 Cr", "onHold"),
  unit("A-201", "2", "2", "1,060 sq.ft", "East", "₹80 L", "sold"),
  unit("A-202", "2", "3", "1,460 sq.ft", "North", "₹1.14 Cr", "available"),
  unit("B-301", "3", "3", "1,480 sq.ft", "West", "₹1.18 Cr", "available"),
  unit("B-302", "3", "2", "1,075 sq.ft", "South", "₹84 L", "blocked"),
];

const PLOT_UNIT = unit("Plot-07", "—", "—", "2,400 sq.ft", "—", "—", "available", true);

const LONG_UNIT = unit(
  "Tower-B-Penthouse-Duplex-Wing-North-Block-0000000000000000000",
  "40",
  "5",
  "12,345 sq.ft",
  "North",
  "₹12.45 Cr",
  "onHold",
);

const STATES = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "hold", label: "On hold" },
  { value: "sold", label: "Sold" },
];

function Units({
  rows,
  intro = "Manage the units in your projects.",
  count,
  note = true,
}: {
  rows: UnitRow[];
  intro?: string;
  count?: string;
  note?: boolean;
}) {
  const [state, setState] = useState("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("vista");
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState(EMPTY);
  return (
    <>
      <UnitsManager
        headingLevel="h2"
        title="Units"
        intro={intro}
        addLabel="Add unit"
        onAdd={() => setAdding(true)}
        project={{
          label: "Project",
          options: [
            { value: "vista", label: "Kadal Vista" },
            { value: "courts", label: "Kadal Courts" },
          ],
          value: project,
          onChange: setProject,
        }}
        search={{
          value: query,
          onChange: setQuery,
          label: "Search units",
          placeholder: "Search unit number",
        }}
        states={{ label: "Filter by state", options: STATES, value: state, onChange: setState }}
        columns={COLUMNS}
        caption="Units"
        rows={rows}
        countText={count ?? `${rows.length} units`}
        {...(note ? { note: "Units can't be moved to another project." } : {})}
        empty={{
          title: "No units in this project yet",
          text: "Add units so buyers can see what is available.",
        }}
      />
      <ManagerDrawer
        open={adding}
        onOpenChange={setAdding}
        title="Add unit"
        closeLabel="Close"
        cancelLabel="Cancel"
        submitLabel="Save unit"
        formId="lab-units-form"
      >
        <UnitForm
          id="lab-units-form"
          values={values}
          onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
          onSubmit={() => setAdding(false)}
          words={WORDS}
        />
      </ManagerDrawer>
    </>
  );
}

function DeleteQuestion() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="danger-outline" onClick={() => setOpen(true)}>
        Open: delete a unit
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Delete unit B-302?"
        description="This removes the unit from the project. This can't be undone."
        confirmLabel="Delete unit"
        cancelLabel="Cancel"
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export function UnitsManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The Units page of a project: the state chips, the table with Edit and Delete on each row, the line under it (Add unit opens the drawer: try it)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Units rows={UNITS} count="6 of 320 units" />
        </Stage>
      </Specimen>
      <Specimen
        label="A unit with no floor, bedrooms, facing or price (a dash), a very long unit number, and the first row being deleted"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Units
            rows={[PLOT_UNIT, LONG_UNIT]}
            intro="Manage the units of any project."
            note={false}
          />
        </Stage>
      </Specimen>
      <Specimen label="No units in this project yet" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Units rows={[]} />
        </Stage>
      </Specimen>
      <Specimen label="The question before deleting a unit (try it)">
        <DeleteQuestion />
      </Specimen>
    </div>
  );
}

/* ── LeadsTable ──────────────────────────────────────────────────── */

const LEAD_COLUMNS = {
  date: "Date",
  project: "Project",
  type: "Type",
  name: "Name",
  phone: "Phone",
  email: "Email",
  message: "Message",
  status: "Status",
};

const LEAD_STATES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

const KINDS = {
  enquiry: <Badge tone="info">Enquiry</Badge>,
  visit: <Badge tone="featured">Site visit</Badge>,
  brochure: <Badge tone="neutral">Brochure</Badge>,
};

function lead(
  id: string,
  date: string,
  project: string,
  kind: keyof typeof KINDS,
  name: string,
  phone: string,
  email: string | null,
  message: string | null,
  value: string,
  disabled = false,
): LeadRow {
  return {
    id,
    date,
    project,
    type: KINDS[kind],
    name,
    phone: { text: phone, href: `tel:${phone.replace(/\s+/g, "")}` },
    email: email ?? "—",
    message: message ?? "—",
    status: {
      value,
      label: `Status for ${name}`,
      options: LEAD_STATES,
      onChange: NOTHING,
      disabled,
    },
  };
}

const LEADS = [
  lead(
    "1",
    "28 Oct, 10:42",
    "Kadal Vista",
    "enquiry",
    "Arjun Menon",
    "98410 55512",
    "arjun.menon@example.com",
    "Is a 3 BHK on a high floor still available?",
    "new",
  ),
  lead(
    "2",
    "28 Oct, 09:15",
    "Arivu Heights",
    "visit",
    "Divya Krishnan",
    "98840 21098",
    null,
    "Saturday morning works.",
    "contacted",
  ),
  lead(
    "3",
    "27 Oct, 18:03",
    "Kadal Vista",
    "brochure",
    "Revathi P",
    "99401 88231",
    "revathi.p@example.com",
    null,
    "closed",
  ),
  lead(
    "4",
    "27 Oct, 14:27",
    "Nila Grove",
    "enquiry",
    "Suresh N",
    "97876 20144",
    "suresh.n@example.com",
    "Please share the payment plan.",
    "new",
    true,
  ),
];

const LONG_LEAD = [
  lead(
    "5",
    "26 Oct, 08:00",
    "Sri Venkateswara Meenakshi Sundaram Signature Residences, Phase Two",
    "enquiry",
    "Venkatasubramanian Ramanathan Krishnamurthy",
    "98400 12345",
    "venkatasubramanian.ramanathan.krishnamurthy.enquiries@example-company.example",
    "I would like to know the total cost including parking, registration and maintenance deposit for a 3 BHK on the 12th floor facing east, and whether a loan tie-up with a bank is available for this tower.",
    "contacted",
  ),
];

export function LeadsTableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The admin's project leads: the state is a box on every row (the last one is saving); a missing email or message is a dash"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <div className="flex flex-col gap-4">
            <Heading as="h2" size="1">
              Leads
            </Heading>
            <Text tone="muted">Project leads and form submissions across the platform.</Text>
            <LeadsTable
              caption="Project leads"
              columns={LEAD_COLUMNS}
              rows={LEADS}
              countText="4 leads"
            />
          </div>
        </Stage>
      </Specimen>
      <Specimen
        label="A builder's leads: the same table, with the line that says only the state can be changed"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <LeadsTable
            caption="Leads for your projects"
            columns={LEAD_COLUMNS}
            rows={LEADS.slice(0, 2)}
            countText="2 leads"
            note="You can change a lead's status. Contact details can't be edited."
          />
        </Stage>
      </Specimen>
      <Specimen label="A very long name, email, project and message" className="w-full">
        <Stage tone="canvas" className="w-full">
          <LeadsTable
            caption="Project leads"
            columns={LEAD_COLUMNS}
            rows={LONG_LEAD}
            countText="1 lead"
          />
        </Stage>
      </Specimen>
    </div>
  );
}
