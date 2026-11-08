"use client";

import { Ellipsis, Pencil, Plus, Power, RotateCw, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  BuilderForm,
  type BuilderFormField,
  type BuilderFormValues,
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
import { Sheet, SheetClose, SheetContent } from "@/components/patterns/sheet";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { EMPTY_BUILDER_VALUES, initialsOf, isFormField, lastSignInText, valuesOf } from "./form";
import type { BuilderRowView } from "./view";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

export type BuildersBoardActions = {
  invite: (
    input: BuilderFormValues,
  ) => Promise<ActionResult<{ builderId: string; signInUrl: string }>>;
  resend: (input: {
    builderId: string;
  }) => Promise<ActionResult<{ builderId: string; signInUrl: string }>>;
  setActive: (input: {
    builderId: string;
    active: boolean;
  }) => Promise<ActionResult<{ builderId: string; active: boolean }>>;
  update: (
    input: BuilderFormValues & { builderId: string },
  ) => Promise<ActionResult<{ builderId: string }>>;
};

type BuildersBoardProps = {
  builders: BuilderRowView[];
  /** When the page was read, so "3 days ago" is worked out from the same moment on the server and in the browser. */
  now: number;
  actions: BuildersBoardActions;
};

/** What the drawer is showing: nothing, the invite form, the edit form, or the address to pass on. */
type Panel =
  | { kind: "invite" }
  | { kind: "edit"; id: string }
  | { kind: "address"; email: string; url: string; invited: boolean };

type FormErrors = Partial<Record<BuilderFormField, string>>;

/**
 * The admin's Builders page (S7-T05, FR-ADM-04): the heading with New builder, the table, and the drawers and
 * question that go with it. It calls the four actions it is given and keeps nothing the server does not also know:
 * after each change the page is read again. Nothing is emailed (DEC-27), so after inviting (and after "Resend
 * invitation") the drawer shows the sign-in address for the admin to copy and pass on.
 */
export function BuildersBoard({ builders, now, actions }: BuildersBoardProps) {
  const translate = useTranslations("admin.builders");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [panel, setPanel] = useState<Panel | null>(null);
  const [values, setValues] = useState<BuilderFormValues>(EMPTY_BUILDER_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const deactivating = builders.find((builder) => builder.id === deactivateId) ?? null;
  const editing =
    panel?.kind === "edit" ? builders.find((builder) => builder.id === panel.id) : undefined;

  const openInvite = () => {
    setValues(EMPTY_BUILDER_VALUES);
    setErrors({});
    setPanel({ kind: "invite" });
  };

  const openEdit = (builder: BuilderRowView) => {
    setValues(valuesOf(builder));
    setErrors({});
    setPanel({ kind: "edit", id: builder.id });
  };

  /** A failure with no box to blame: said in a toast, and the page is read again so it shows the truth. */
  const reportFailure = (failure: Failure) => {
    notify.error(
      failure.code === "CONFLICT" ? translate("conflict") : failureText(everything, failure),
    );
    router.refresh();
  };

  /** Puts a failure's field messages on their boxes; true when at least one box got one. */
  const showFieldErrors = (failure: Failure): boolean => {
    const next: FormErrors = {};
    for (const [field, problems] of Object.entries(failure.fieldErrors ?? {})) {
      const first = problems[0];
      if (first && isFormField(field)) next[field] = fieldErrorText(everything, first);
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const change = (field: BuilderFormField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }) as BuilderFormValues);
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!panel || sending) return;
    setSending(true);
    try {
      if (panel.kind === "invite") {
        const result = await actions.invite(values);
        if (!result.ok) {
          if (!showFieldErrors(result)) reportFailure(result);
          return;
        }
        const email = values.email.trim().toLowerCase();
        setPanel({ kind: "address", email, url: result.data.signInUrl, invited: true });
        notify.success(translate("toast.invited.title"), {
          description: translate("toast.invited.text", { email }),
        });
        router.refresh();
      } else if (panel.kind === "edit") {
        const result = await actions.update({ ...values, builderId: panel.id });
        if (!result.ok) {
          if (!showFieldErrors(result)) reportFailure(result);
          return;
        }
        setPanel(null);
        notify.success(translate("toast.saved.title"), {
          description: translate("toast.saved.text"),
        });
        router.refresh();
      }
    } finally {
      setSending(false);
    }
  };

  const resend = async (builder: BuilderRowView) => {
    const result = await actions.resend({ builderId: builder.id });
    if (!result.ok) {
      reportFailure(result);
      return;
    }
    setPanel({
      kind: "address",
      email: builder.email,
      url: result.data.signInUrl,
      invited: false,
    });
    router.refresh();
  };

  const setActive = async (builder: BuilderRowView, active: boolean) => {
    setChanging(true);
    const result = await actions.setActive({ builderId: builder.id, active });
    setChanging(false);
    if (!result.ok) {
      reportFailure(result);
      return;
    }
    notify.success(translate(active ? "toast.activated.title" : "toast.deactivated.title"), {
      description: translate(active ? "toast.activated.text" : "toast.deactivated.text", {
        name: builder.name,
      }),
    });
    router.refresh();
  };

  const rows: BuilderTableRow[] = builders.map((builder) => ({
    id: builder.id,
    name: builder.name,
    email: builder.email,
    initials: initialsOf(builder.name),
    ...(builder.kind === "agent"
      ? { type: <Badge tone="outline">{translate("kindAgent")}</Badge> }
      : {}),
    status: <StatusBadge kind="builder" status={builder.status} />,
    projects: String(builder.projects),
    leads: String(builder.leads),
    lastSignIn: lastSignInText(everything, locale, builder.lastSignInAt, now),
    actions: (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconStart={<Icon icon={Pencil} size="sm" />}
          onClick={() => openEdit(builder)}
        >
          {translate("actions.edit")} <span className="sr-only">{builder.name}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={translate("actions.more", { name: builder.name })}>
              <Icon icon={Ellipsis} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              icon={<Icon icon={Pencil} size="sm" />}
              onSelect={() => openEdit(builder)}
            >
              {translate("actions.editDetails")}
            </DropdownMenuItem>
            {builder.status === "invited" ? (
              <DropdownMenuItem
                icon={<Icon icon={RotateCw} size="sm" />}
                onSelect={() => void resend(builder)}
              >
                {translate("actions.resend")}
              </DropdownMenuItem>
            ) : null}
            {builder.status === "inactive" ? (
              <DropdownMenuItem
                icon={<Icon icon={Power} size="sm" />}
                onSelect={() => void setActive(builder, true)}
              >
                {translate("actions.activate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                destructive
                icon={<Icon icon={Power} size="sm" />}
                onSelect={() => setDeactivateId(builder.id)}
              >
                {translate("actions.deactivate")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ),
  }));

  const newBuilder = (
    <Button
      type="button"
      variant="primary"
      iconStart={<Icon icon={Plus} size="sm" />}
      onClick={openInvite}
    >
      {translate("actions.new")}
    </Button>
  );

  const formWords = {
    name: translate("form.name"),
    email: translate("form.email"),
    emailHint: translate("form.emailHint"),
    emailLockedHint: translate("form.emailLockedHint"),
    kind: translate("form.kind"),
    kindBuilder: translate("kindBuilder"),
    kindAgent: translate("kindAgent"),
    contactPerson: translate("form.contactPerson"),
    phone: translate("form.phone"),
    logoUrl: translate("form.logoUrl"),
    website: translate("form.website"),
    description: translate("form.description"),
    optional: translate("form.optional"),
  };

  const FORM_ID = "builder-form";

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as="h1" size="1">
            {translate("title")}
          </Heading>
          <Text tone="muted">{translate("intro")}</Text>
        </div>
        {newBuilder}
      </div>

      {builders.length === 0 ? (
        <EmptyState title={translate("empty.title")} description={translate("empty.text")}>
          {newBuilder}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <BuilderTable
            caption={translate("table.caption")}
            columns={{
              company: translate("table.company"),
              status: translate("table.status"),
              projects: translate("table.projects"),
              leads: translate("table.leads"),
              lastSignIn: translate("table.lastSignIn"),
              actions: translate("table.actions"),
            }}
            rows={rows}
          />
          <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
            <span>{translate("count", { count: builders.length })}</span>
            <span>{translate("footnote")}</span>
          </p>
        </div>
      )}

      <Sheet
        open={panel !== null && (panel.kind !== "edit" || editing !== undefined)}
        onOpenChange={(open) => {
          if (!open && !sending) setPanel(null);
        }}
      >
        {panel?.kind === "address" ? (
          <SheetContent
            side="right"
            title={translate(panel.invited ? "address.invitedTitle" : "address.title")}
            closeLabel={translate("close")}
            description={translate("address.text")}
            footer={
              <SheetClose asChild>
                <Button type="button" variant="primary">
                  {translate("address.done")}
                </Button>
              </SheetClose>
            }
          >
            <div className="flex flex-col gap-5">
              <p className="text-body text-ink [overflow-wrap:anywhere]">
                {translate("address.ask", { email: panel.email })}
              </p>
              <SignInAddress
                label={translate("address.label")}
                address={panel.url}
                copyLabel={translate("address.copy")}
                copiedLabel={translate("address.copied")}
                hint={translate("address.hint")}
              />
            </div>
          </SheetContent>
        ) : panel ? (
          <SheetContent
            side="right"
            title={translate(panel.kind === "invite" ? "invite.title" : "edit.title")}
            closeLabel={translate("close")}
            description={translate(panel.kind === "invite" ? "invite.text" : "edit.text")}
            footer={
              <>
                <SheetClose asChild>
                  <Button type="button" variant="secondary" disabled={sending}>
                    {translate("cancel")}
                  </Button>
                </SheetClose>
                <Button type="submit" form={FORM_ID} variant="primary" loading={sending}>
                  {translate(panel.kind === "invite" ? "invite.submit" : "edit.submit")}
                </Button>
              </>
            }
          >
            <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate>
              <BuilderForm
                mode={panel.kind === "invite" ? "invite" : "edit"}
                values={values}
                errors={errors}
                onChange={change}
                disabled={sending}
                words={formWords}
              />
            </form>
          </SheetContent>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open && !changing) setDeactivateId(null);
        }}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title={translate("deactivate.title", { name: deactivating?.name ?? "" })}
        description={translate("deactivate.text")}
        confirmLabel={translate("actions.deactivate")}
        cancelLabel={translate("cancel")}
        loading={changing}
        onConfirm={() => {
          if (!deactivating) return;
          void setActive(deactivating, false).then(() => setDeactivateId(null));
        }}
      />
    </div>
  );
}
