"use client";

import { Ellipsis, Pencil, Plus, Power, RotateCw, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  BuilderForm,
  type BuilderFormField,
  type BuilderFormValues,
  type BuilderFormWords,
} from "@/components/domain/builder-form";
import { BuilderTable, type BuilderTableRow } from "@/components/domain/builder-table";
import { SignInAddress } from "@/components/domain/sign-in-address";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/patterns/dropdown-menu";
import { EmptyState } from "@/components/patterns/empty-state";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { notify } from "@/lib/notify";
import { Specimen, Stage } from "../frame";

/**
 * The admin's Builders page in its states (S7-T05): the table with a row menu, the invite and edit forms, the
 * address the admin passes on after inviting, and the confirmations. Plain English text; nothing here goes anywhere.
 * The words that are not in the approved UX file are listed in ADR-076 for the owner to confirm.
 */

const COLUMNS = {
  company: "Company",
  status: "Status",
  projects: "Projects",
  leads: "Leads",
  lastSignIn: "Last sign-in",
  actions: "Actions",
};

type RowState = "active" | "invited" | "inactive";

function RowActions({ name, state }: { name: string; state: RowState }) {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconStart={<Icon icon={Pencil} size="sm" />}
      >
        Edit <span className="sr-only">{name}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label={`More actions for ${name}`}>
            <Icon icon={Ellipsis} />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<Icon icon={Pencil} size="sm" />}>Edit details</DropdownMenuItem>
          {state === "invited" ? (
            <DropdownMenuItem icon={<Icon icon={RotateCw} size="sm" />}>
              Resend invitation
            </DropdownMenuItem>
          ) : null}
          {state === "inactive" ? (
            <DropdownMenuItem icon={<Icon icon={Power} size="sm" />}>Activate</DropdownMenuItem>
          ) : (
            <DropdownMenuItem destructive icon={<Icon icon={Power} size="sm" />}>
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function row(
  id: string,
  name: string,
  email: string,
  state: RowState,
  numbers: { projects: number; leads: number },
  lastSignIn: string,
  agent = false,
): BuilderTableRow {
  return {
    id,
    name,
    email,
    initials: name
      .split(" ")
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase(),
    ...(agent ? { type: <Badge tone="outline">Agent</Badge> } : {}),
    status: <StatusBadge kind="builder" status={state} />,
    projects: String(numbers.projects),
    leads: String(numbers.leads),
    lastSignIn,
    actions: <RowActions name={name} state={state} />,
  };
}

const SAMPLE_ROWS: BuilderTableRow[] = [
  row(
    "1",
    "Kadal Homes",
    "sales@kadalhomes.example",
    "active",
    { projects: 4, leads: 148 },
    "Today, 09:40",
  ),
  row(
    "2",
    "Nila Habitats",
    "office@nilahabitats.example",
    "active",
    { projects: 3, leads: 33 },
    "3 days ago",
  ),
  row(
    "3",
    "Thendral Estates",
    "hello@thendralestates.example",
    "invited",
    { projects: 0, leads: 0 },
    "Hasn't signed in yet",
    true,
  ),
  row(
    "4",
    "Arivu Constructions",
    "info@arivuconstructions.example",
    "inactive",
    { projects: 2, leads: 96 },
    "2 months ago",
  ),
];

const LONG_ROWS: BuilderTableRow[] = [
  row(
    "5",
    "Sri Venkateswara Meenakshi Sundaram Constructions and Developers Private Limited",
    "customer.relations.and.sales.enquiries.chennai@srivenkateswarameenakshisundaram.example",
    "active",
    { projects: 12, leads: 1204 },
    "Yesterday, 18:05",
    true,
  ),
  row("6", "AB", "ab@example.test", "invited", { projects: 0, leads: 0 }, "Hasn't signed in yet"),
];

function PageHead() {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Heading as="h2" size="1">
          Builders
        </Heading>
        <Text tone="muted">
          Invite builders and manage their access. Accounts are created by invitation only.
        </Text>
      </div>
      <Button type="button" variant="primary" iconStart={<Icon icon={Plus} size="sm" />}>
        New builder
      </Button>
    </div>
  );
}

function SamplePage({ rows, foot = true }: { rows: BuilderTableRow[]; foot?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHead />
      <BuilderTable caption="Builders" columns={COLUMNS} rows={rows} />
      {foot ? (
        <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
          <span>12 builders</span>
          <span>Builders can be deactivated but not deleted.</span>
        </p>
      ) : null}
    </div>
  );
}

function Confirmations() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="danger-outline" onClick={() => setOpen(true)}>
        Open: deactivate
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          notify.success("Builder invited", {
            description: "hello@thendralestates.example can now sign in with Google.",
          })
        }
      >
        Show the toast
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Deactivate Kadal Homes?"
        description="They will lose access to the builder portal and will no longer appear in the developer showcase on the home page. You can activate them again at any time."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

export function BuilderTableDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The Builders page: Active, Invited (an agent, who has not signed in) and Inactive, with the row menu (try it) and the line under the table"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <SamplePage rows={SAMPLE_ROWS} />
        </Stage>
      </Specimen>
      <Specimen
        label="A very long company name and email, a builder with a short name, and big numbers"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <SamplePage rows={LONG_ROWS} foot={false} />
        </Stage>
      </Specimen>
      <Specimen label="No builders yet" className="w-full">
        <Stage tone="canvas" className="w-full">
          <div className="flex flex-col gap-4">
            <PageHead />
            <EmptyState
              title="No builders yet"
              description="Invite a builder and share the sign-in address with them."
            />
          </div>
        </Stage>
      </Specimen>
      <Specimen
        label="The confirmation before deactivating, and the toast after an invitation (try them; Escape or Cancel closes the question)"
        className="w-full"
      >
        <Confirmations />
      </Specimen>
    </div>
  );
}

const WORDS: BuilderFormWords = {
  name: "Company name",
  email: "Login email",
  emailHint: "They sign in with Google using this email.",
  emailLockedHint: "The login email cannot be changed.",
  kind: "Type",
  kindBuilder: "Builder",
  kindAgent: "Agent",
  contactPerson: "Contact person",
  phone: "Phone",
  logoUrl: "Logo link",
  website: "Website",
  description: "About",
  optional: "(optional)",
};

const EMPTY: BuilderFormValues = {
  name: "",
  email: "",
  kind: "builder",
  contactPerson: "",
  phone: "",
  logoUrl: "",
  website: "",
  description: "",
};

const FILLED: BuilderFormValues = {
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  contactPerson: "Meena Raj",
  phone: "+91 98410 55512",
  logoUrl: "https://kadalhomes.example/logo.png",
  website: "https://kadalhomes.example",
  description: "Ready-to-move apartments in west Chennai.",
};

function LiveForm({
  initial,
  mode,
  errors,
  disabled,
}: {
  initial: BuilderFormValues;
  mode: "invite" | "edit";
  errors?: Partial<Record<BuilderFormField, string>>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <BuilderForm
      mode={mode}
      values={values}
      {...(errors ? { errors } : {})}
      {...(disabled ? { disabled } : {})}
      onChange={(field, value) => setValues((now) => ({ ...now, [field]: value }))}
      words={WORDS}
    />
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-135 rounded-xl border border-line bg-surface p-6">{children}</div>
  );
}

const ADDRESS = "https://findsprop.com/builder/login";

/** The invite drawer: the form, then (after Invite builder) the address to pass on. Try it. */
function InviteOpener() {
  const [done, setDone] = useState(false);
  return (
    <Sheet onOpenChange={(open) => (open ? undefined : setDone(false))}>
      <SheetTrigger asChild>
        <Button type="button" variant="primary" iconStart={<Icon icon={Plus} size="sm" />}>
          Open: New builder
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        title={done ? "Builder invited" : "New builder"}
        closeLabel="Close"
        description={
          done
            ? "Nothing is emailed. Pass this address on to them."
            : "They sign in with Google, so no password is needed."
        }
        footer={
          done ? (
            <SheetClose asChild>
              <Button type="button" variant="primary">
                Done
              </Button>
            </SheetClose>
          ) : (
            <>
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="button" variant="primary" onClick={() => setDone(true)}>
                Invite builder
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col gap-5">
            <p className="text-body text-ink">
              Ask <b>sales@kadalhomes.example</b> to sign in with Google using that same email.
            </p>
            <SignInAddress
              label="Sign-in address"
              address={ADDRESS}
              copyLabel="Copy address"
              copiedLabel="Copied"
              hint="They must use the Google account with the email above."
            />
          </div>
        ) : (
          <LiveForm initial={FILLED} mode="invite" />
        )}
      </SheetContent>
    </Sheet>
  );
}

export function BuilderFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="New builder: empty">
        <Card>
          <LiveForm initial={EMPTY} mode="invite" />
        </Card>
      </Specimen>
      <Specimen label="New builder: an email that cannot be used and a name that is too short">
        <Card>
          <LiveForm
            initial={{ ...EMPTY, name: "K", email: "support@drizzlemarketings.com" }}
            mode="invite"
            errors={{
              name: "Enter at least 2 characters.",
              email: "This email can't be used for a builder account.",
            }}
          />
        </Card>
      </Specimen>
      <Specimen label="Edit details: the login email is shown and cannot be changed; an agent">
        <Card>
          <LiveForm initial={{ ...FILLED, kind: "agent" }} mode="edit" />
        </Card>
      </Specimen>
      <Specimen label="Sending the invitation: every box is off">
        <Card>
          <LiveForm initial={FILLED} mode="invite" disabled />
        </Card>
      </Specimen>
      <Specimen label="The drawer, closed and opened by its button; after Invite builder it shows the address to pass on (try it)">
        <InviteOpener />
      </Specimen>
    </div>
  );
}

export function SignInAddressDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The address and its Copy button (click it: the button says Copied for a few seconds)">
        <Card>
          <SignInAddress
            label="Sign-in address"
            address={ADDRESS}
            copyLabel="Copy address"
            copiedLabel="Copied"
            hint="They must use the Google account with the email above."
          />
        </Card>
      </Specimen>
      <Specimen label="A very long address, with no hint, on a narrow card">
        <div className="w-full max-w-80 rounded-xl border border-line bg-surface p-6">
          <SignInAddress
            label="Sign-in address"
            address="https://staging-findsprop-preview-builders.example.com/builder/login?next=/builder/projects"
            copyLabel="Copy address"
            copiedLabel="Copied"
          />
        </div>
      </Specimen>
    </div>
  );
}
