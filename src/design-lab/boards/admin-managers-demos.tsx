"use client";

import { Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ProjectsManager, type ProjectRow } from "@/components/domain/projects-manager";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { FormField } from "@/components/patterns/form-field";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/patterns/responsive-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Specimen, Stage } from "../frame";

/**
 * The lists that the admin and the builder share (S7-T01): the table that becomes cards, the drawer for adding and
 * editing a row, and the Projects page in both modes. Plain English text and drawn pictures; nothing here goes
 * anywhere. The words come from the approved admin-projects and builder-projects screens; the few that do not are
 * listed in ADR-078 for the owner to confirm.
 */

const NOTHING = () => undefined;

/* ── ResponsiveTable ─────────────────────────────────────────────── */

const SAMPLE_COLUMNS: ResponsiveTableColumn[] = [
  { id: "unit", heading: "Unit", role: "main", width: 16 },
  { id: "bhk", heading: "BHK", width: 10 },
  { id: "area", heading: "Area", align: "end", width: 16, nowrap: true },
  { id: "facing", heading: "Facing", width: 14 },
  { id: "price", heading: "Price", align: "end", width: 16, nowrap: true },
  { id: "status", heading: "Status", width: 16 },
  { id: "actions", heading: "Actions", role: "actions", width: 12 },
];

function unitRow(
  id: string,
  bhk: string,
  area: string,
  facing: string,
  price: string,
  status: "available" | "onHold" | "sold" | "blocked",
) {
  return {
    id,
    cells: {
      unit: <b className="text-ink">{id}</b>,
      bhk,
      area,
      facing,
      price: <span className="font-bold text-ink tabular-nums">{price}</span>,
      status: <StatusBadge kind="unit" status={status} />,
      actions: (
        <Button type="button" variant="ghost" size="sm">
          Edit <span className="sr-only">unit {id}</span>
        </Button>
      ),
    },
  };
}

const SAMPLE_ROWS = [
  unitRow("A-101", "2", "1,050 sq.ft", "East", "₹78 L", "available"),
  unitRow("A-102", "3", "1,450 sq.ft", "North", "₹1.12 Cr", "onHold"),
  unitRow("A-201", "2", "1,060 sq.ft", "East", "₹80 L", "sold"),
  unitRow("B-302", "2", "1,075 sq.ft", "South", "₹84 L", "blocked"),
];

const LONG_ROWS = [
  {
    id: "long",
    cells: {
      unit: (
        <b className="text-ink [overflow-wrap:anywhere]">
          Tower-B-Penthouse-Duplex-Wing-North-Block-0000000000000000000
        </b>
      ),
      bhk: "4",
      area: "12,345 sq.ft",
      facing: "North-east",
      price: <span className="font-bold text-ink tabular-nums">₹12.45 Cr</span>,
      status: <StatusBadge kind="unit" status="available" />,
      actions: <Badge tone="outline">No actions</Badge>,
    },
  },
];

export function ResponsiveTableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="A table from 1024 px of room: headings above, one row per unit, the buttons at the right"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <ResponsiveTable caption="Units" columns={SAMPLE_COLUMNS} rows={SAMPLE_ROWS} />
        </Stage>
      </Specimen>
      <Specimen
        label="The same list in a narrow area: cards, each value under its word, the buttons at the foot"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full max-w-120">
          <ResponsiveTable
            caption="Units"
            columns={SAMPLE_COLUMNS}
            rows={SAMPLE_ROWS.slice(0, 2)}
          />
        </Stage>
      </Specimen>
      <Specimen label="A very long unit name that has to wrap, in a card" className="w-full">
        <Stage tone="canvas" className="w-full max-w-120">
          <ResponsiveTable caption="Units" columns={SAMPLE_COLUMNS} rows={LONG_ROWS} />
        </Stage>
      </Specimen>
    </div>
  );
}

/* ── ManagerDrawer ───────────────────────────────────────────────── */

function UnitForm({ id, onSubmit }: { id: string; onSubmit: () => void }) {
  return (
    <form
      id={id}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormField label="Unit number" required>
        <Input defaultValue="B-303" />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Floor">
          <Input inputMode="numeric" defaultValue="3" />
        </FormField>
        <FormField label="BHK">
          <NativeSelect defaultValue="3">
            <option value="2">2</option>
            <option value="3">3</option>
          </NativeSelect>
        </FormField>
        <FormField label="Area (sq.ft)">
          <Input inputMode="numeric" defaultValue="1480" />
        </FormField>
        <FormField label="Price (₹)">
          <Input inputMode="numeric" defaultValue="11800000" />
        </FormField>
      </div>
    </form>
  );
}

function DrawerOpeners() {
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [reading, setReading] = useState(false);
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="primary"
        iconStart={<Icon icon={Plus} size="sm" />}
        onClick={() => setAdding(true)}
      >
        Open: Add unit
      </Button>
      <Button type="button" variant="secondary" onClick={() => setReading(true)}>
        Open: a drawer that only shows
      </Button>
      <ManagerDrawer
        open={adding}
        onOpenChange={setAdding}
        title="Add unit"
        description="Add a unit so buyers can see what is available."
        closeLabel="Close"
        cancelLabel="Cancel"
        submitLabel="Save unit"
        formId="lab-unit-form"
        pending={sending}
      >
        <UnitForm
          id="lab-unit-form"
          onSubmit={() => {
            setSending(true);
            window.setTimeout(() => {
              setSending(false);
              setAdding(false);
            }, 900);
          }}
        />
      </ManagerDrawer>
      <ManagerDrawer
        open={reading}
        onOpenChange={setReading}
        title="Submission details"
        closeLabel="Close"
        cancelLabel="Close"
      >
        <p className="text-body text-ink">
          Nothing to edit here: one Close button is shown, and it is the main button.
        </p>
      </ManagerDrawer>
    </div>
  );
}

export function ManagerDrawerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Add unit: Cancel and Save unit stay in view while the form scrolls (try it; Save unit works for a moment, then closes)">
        <DrawerOpeners />
      </Specimen>
    </div>
  );
}

/* ── ProjectsManager ─────────────────────────────────────────────── */

const COLUMNS = {
  project: "Project",
  builder: "Builder",
  priceRange: "Price range",
  status: "Status",
  actions: "Actions",
};

type Moderation = "pending" | "approved" | "rejected" | "draft";

function statusOf(moderation: Moderation, published?: boolean, featured?: boolean) {
  return (
    <>
      <StatusBadge kind="project" status={moderation} />
      {moderation === "approved" ? (
        <Badge tone={published ? "info" : "outline"}>
          {published ? "Published" : "Unpublished"}
        </Badge>
      ) : null}
      {featured ? <Badge tone="featured">Featured</Badge> : null}
    </>
  );
}

function project(
  name: string,
  builder: string,
  place: string,
  priceRange: string,
  moderation: Moderation,
  options: { published?: boolean; featured?: boolean; leads?: number; admin: boolean },
): ProjectRow {
  const { published = false, featured = false, leads = 0, admin } = options;
  const actions: ProjectRow["actions"] = [];
  if (admin) {
    if (moderation === "pending") {
      actions.push(
        {
          id: "approve",
          label: "Approve",
          forName: name,
          tone: "primary",
          icon: "check",
          onClick: NOTHING,
        },
        {
          id: "reject",
          label: "Reject",
          forName: name,
          tone: "danger-outline",
          icon: "cross",
          onClick: NOTHING,
        },
      );
    } else if (moderation === "rejected") {
      actions.push({
        id: "approve",
        label: "Approve",
        forName: name,
        tone: "secondary",
        icon: "check",
        onClick: NOTHING,
      });
    } else if (moderation === "approved") {
      actions.push(
        published
          ? {
              id: "unpublish",
              label: "Unpublish",
              forName: name,
              tone: "secondary",
              onClick: NOTHING,
            }
          : {
              id: "publish",
              label: "Publish",
              forName: name,
              tone: "primary",
              icon: "upload",
              onClick: NOTHING,
            },
      );
    }
  } else {
    actions.push({
      id: "edit",
      label: "Edit",
      forName: name,
      tone: "secondary",
      icon: "edit",
      href: "#edit",
    });
    if (published && moderation === "approved") {
      actions.push({
        id: "live",
        label: "View live",
        forName: name,
        tone: "ghost",
        icon: "external",
        href: "#live",
      });
    }
  }
  return {
    id: name,
    name,
    place,
    ...(admin ? { builder } : {}),
    priceRange,
    status: statusOf(moderation, published, featured),
    actions,
    ...(admin
      ? {
          menu: [
            { id: "edit", label: "Edit project", icon: "edit" as const, href: "#edit" },
            {
              id: "feature",
              label: featured ? "Remove from featured" : "Feature",
              icon: "star" as const,
              onSelect: NOTHING,
            },
            { id: "live", label: "View live page", icon: "external" as const, href: "#live" },
            leads > 0
              ? {
                  id: "delete",
                  label: `Delete (has ${leads} leads)`,
                  icon: "trash" as const,
                  destructive: true,
                  disabled: true,
                }
              : {
                  id: "delete",
                  label: "Delete",
                  icon: "trash" as const,
                  destructive: true,
                  onSelect: NOTHING,
                },
          ],
          moreLabel: `More actions for ${name}`,
        }
      : {}),
  };
}

const ADMIN_ROWS = [
  project("Kadal Vista", "Kadal Homes", "OMR Navalur", "₹78 L – ₹1.42 Cr", "approved", {
    published: true,
    featured: true,
    leads: 128,
    admin: true,
  }),
  project("Nila Grove", "Nila Habitats", "Medavakkam", "₹62 L – ₹98 L", "pending", {
    leads: 12,
    admin: true,
  }),
  project("Thendral Residency", "Thendral Estates", "Porur", "₹88 L – ₹1.3 Cr", "approved", {
    admin: true,
  }),
  project("Nila Meadows", "Nila Habitats", "Guindy", "₹1.4 Cr – ₹2.2 Cr", "rejected", {
    leads: 21,
    admin: true,
  }),
];

const BUILDER_ROWS = [
  project("Kadal Vista", "Kadal Homes", "OMR Navalur", "₹78 L – ₹1.42 Cr", "approved", {
    published: true,
    admin: false,
  }),
  project("Kadal Courts", "Kadal Homes", "OMR Siruseri", "₹54 L – ₹86 L", "pending", {
    admin: false,
  }),
  project("Kadal Bay", "Kadal Homes", "OMR Navalur", "₹70 L – ₹1.1 Cr", "draft", { admin: false }),
];

const LONG_PROJECT = [
  project(
    "Sri Venkateswara Meenakshi Sundaram Signature Residences, Phase Two, Tower A and B",
    "Sri Venkateswara Meenakshi Sundaram Constructions and Developers Private Limited",
    "Old Mahabalipuram Road, Sholinganallur, Chennai",
    "₹1.42 Cr – ₹12.45 Cr",
    "pending",
    { admin: true },
  ),
];

const ADMIN_TABS = [
  { value: "all", label: "All", count: 7 },
  { value: "pending", label: "Pending", count: 3, countTone: "new" as const },
  { value: "approved", label: "Approved", count: 3 },
  { value: "rejected", label: "Rejected", count: 1 },
  { value: "draft", label: "Draft", count: 0 },
];

const BUILDER_TABS = [
  { value: "all", label: "All", count: 4 },
  { value: "pending", label: "Pending", count: 1 },
  { value: "approved", label: "Approved", count: 2 },
  { value: "rejected", label: "Rejected", count: 0 },
  { value: "draft", label: "Draft", count: 1 },
];

function Manager({
  mode,
  rows,
  count,
  notice,
  working,
}: {
  mode: "admin" | "builder";
  rows: ProjectRow[];
  count?: string;
  notice?: boolean;
  working?: boolean;
}) {
  const admin = mode === "admin";
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [builder, setBuilder] = useState("");
  const shown = working
    ? rows.map((row, index) =>
        index === 0
          ? { ...row, actions: row.actions.map((action) => ({ ...action, pending: true })) }
          : row,
      )
    : rows;
  return (
    <ProjectsManager
      mode={mode}
      headingLevel="h2"
      title="Projects"
      intro={
        admin
          ? "Review, moderate and manage every builder project."
          : "Your projects. Saving an edit sends the project for approval."
      }
      addLabel="Add project"
      addHref="#new-project"
      tabs={admin ? ADMIN_TABS : BUILDER_TABS}
      tab={tab}
      onTabChange={setTab}
      tabsLabel="Filter by status"
      search={{
        value: query,
        onChange: setQuery,
        label: "Search projects",
        placeholder: "Search projects",
      }}
      {...(admin
        ? {
            builderFilter: {
              label: "Builder",
              allLabel: "All builders",
              options: [
                { value: "kadal", label: "Kadal Homes" },
                { value: "nila", label: "Nila Habitats" },
              ],
              value: builder,
              onChange: setBuilder,
            },
          }
        : {
            reapproval: {
              title: "Edits go back for approval",
              text: "When you save a change, the project is set to Pending and is hidden from the public site until it is approved again.",
            },
          })}
      columns={COLUMNS}
      caption="Projects"
      rows={shown}
      countText={count ?? `${rows.length} projects`}
      empty={{
        title: "No projects yet",
        text: admin
          ? "Projects created by builders will appear here for review."
          : "Add your first project. It is reviewed before it goes live.",
      }}
      {...(notice
        ? {
            notice: (
              <Alert tone="danger" title="This project can't be deleted">
                It has 128 leads. Unpublish it instead to take it off the public site.
              </Alert>
            ),
          }
        : {})}
    />
  );
}

function RejectQuestion() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="danger-outline" onClick={() => setOpen(true)}>
        Open: reject
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Reject Nila Grove?"
        description="The builder will see the project as Rejected and it stays off the public site. You can approve it later."
        confirmLabel="Reject project"
        cancelLabel="Cancel"
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export function ProjectsManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The admin's Projects page: Approved and published (featured), Pending (Approve and Reject), Approved but not published (Publish), Rejected, with the row menu (try it; Delete is off for a project with leads)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Manager mode="admin" rows={ADMIN_ROWS} count="6 projects" />
        </Stage>
      </Specimen>
      <Specimen
        label="The builder's Projects page: the warning that edits go back for approval, Edit and View live, a draft"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Manager mode="builder" rows={BUILDER_ROWS} />
        </Stage>
      </Specimen>
      <Specimen
        label="The admin's page when a delete was refused (the page puts its message above the tabs), and a button that is working"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Manager mode="admin" rows={ADMIN_ROWS.slice(0, 2)} notice working />
        </Stage>
      </Specimen>
      <Specimen label="A very long project, builder and place name" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Manager mode="admin" rows={LONG_PROJECT} count="1 project" />
        </Stage>
      </Specimen>
      <Specimen label="No projects yet, for a builder" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Manager mode="builder" rows={[]} />
        </Stage>
      </Specimen>
      <Specimen label="The question before rejecting (try it; the page owns this dialog)">
        <RejectQuestion />
      </Specimen>
    </div>
  );
}
