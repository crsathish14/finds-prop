"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormsManager, type FormRowView } from "@/components/domain/forms-manager";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { failureText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { AdminFormView } from "./view";

type FormsListProps = {
  forms: AdminFormView[];
  actions: {
    setActive: (input: { formId: string; active: boolean }) => Promise<ActionResult<unknown>>;
    duplicate: (input: {
      formId: string;
    }) => Promise<ActionResult<{ formId: string; slug: string }>>;
    remove: (input: { formId: string }) => Promise<ActionResult<unknown>>;
  };
};

/** A switch the admin has just flipped, shown until the page is read again with the saved value. */
type Flip = { formId: string; saved: boolean; shown: boolean };

/**
 * The admin's Forms page (S7-T08, FR-ADM-08): every form with its kind, slug, number of fields, placement, CRM link
 * and an Active switch, and Edit, Duplicate and Delete. It calls the three actions it is given and reads the page
 * again after each change so it shows what the server holds. A switch shows the new position at once and goes back
 * if the save fails. Delete asks first. Only one change runs at a time.
 */
export function AdminForms({ forms, actions }: FormsListProps) {
  const translate = useTranslations("admin.forms");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [deleting, setDeleting] = useState<AdminFormView | null>(null);

  const reportFailure = (failure: Extract<ActionResult<unknown>, { ok: false }>) => {
    notify.error(
      failure.code === "CONFLICT" || failure.code === "NOT_FOUND"
        ? translate("conflict")
        : failureText(everything, failure),
    );
    router.refresh();
  };

  const shownActive = (form: AdminFormView): boolean =>
    flip && flip.formId === form.id && flip.saved === form.active ? flip.shown : form.active;

  const switchForm = async (form: AdminFormView, active: boolean) => {
    if (busy) return;
    setBusy(`${form.id}:active`);
    setFlip({ formId: form.id, saved: form.active, shown: active });
    try {
      const result = await actions.setActive({ formId: form.id, active });
      if (!result.ok) {
        setFlip(null);
        reportFailure(result);
        return;
      }
      notify.success(translate(active ? "toast.on" : "toast.off", { name: form.name }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const copy = async (form: AdminFormView) => {
    if (busy) return;
    setBusy(`${form.id}:copy`);
    try {
      const result = await actions.duplicate({ formId: form.id });
      if (!result.ok) {
        reportFailure(result);
        return;
      }
      notify.success(translate("toast.duplicated"), {
        description: translate("toast.duplicatedText", { slug: result.data.slug }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (form: AdminFormView) => {
    if (busy) return;
    setBusy(`${form.id}:delete`);
    try {
      const result = await actions.remove({ formId: form.id });
      setDeleting(null);
      if (!result.ok) {
        reportFailure(result);
        return;
      }
      notify.success(translate("toast.deleted", { name: form.name }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const placementOf = (form: AdminFormView): string =>
    form.placement === "project_specific" && form.projectName
      ? translate("placementOnly", { name: form.projectName })
      : everything(`admin.forms.placements.${form.placement}`);

  const rows: FormRowView[] = forms.map((form) => ({
    id: form.id,
    name: form.name,
    kind: everything(`admin.forms.kinds.${form.kind}`),
    slug: form.slug,
    fields: form.fields.length,
    placement: placementOf(form),
    crm: form.crmName ?? translate("crmNone"),
    active: {
      checked: shownActive(form),
      onChange: (checked) => void switchForm(form, checked),
      label: translate("activeFor", { name: form.name }),
      disabled: busy !== null,
    },
    edit: {
      href: `/admin/forms/${form.id}`,
      label: translate("edit"),
      forName: form.name,
    },
    duplicate: {
      label: translate("duplicate"),
      forName: form.name,
      onClick: () => void copy(form),
      pending: busy === `${form.id}:copy`,
    },
    remove: {
      label: translate("deleteFor", { name: form.name }),
      onClick: () => setDeleting(form),
    },
  }));

  return (
    <>
      <FormsManager
        title={translate("title")}
        intro={translate("intro")}
        newLabel={translate("new")}
        newHref="/admin/forms/new"
        caption={translate("caption")}
        columns={{
          name: translate("columns.name"),
          slug: translate("columns.slug"),
          fields: translate("columns.fields"),
          placement: translate("columns.placement"),
          crm: translate("columns.crm"),
          active: translate("columns.active"),
          actions: translate("columns.actions"),
        }}
        rows={rows}
        countText={translate("count", { count: rows.length })}
        empty={{ title: translate("empty.title"), text: translate("empty.text") }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        tone="danger"
        icon={<Icon icon={Trash2} size="lg" />}
        title={translate("deleteDialog.title", { name: deleting?.name ?? "" })}
        description={translate("deleteDialog.text")}
        confirmLabel={translate("deleteDialog.confirm")}
        cancelLabel={translate("cancel")}
        loading={busy !== null && deleting !== null && busy === `${deleting.id}:delete`}
        onConfirm={() => (deleting ? void remove(deleting) : undefined)}
      />
    </>
  );
}
