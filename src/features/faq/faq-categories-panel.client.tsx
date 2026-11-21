"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CategoryManager,
  type CategoryFormValues,
  type CategoryRow,
} from "@/components/domain/category-manager";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { Icon } from "@/components/ui/icon";
import {
  CATEGORY_SLUG_MAX,
  slugFromName,
  type CategoryView,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/features/content-categories";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";

type Done = ActionResult<{ categoryId: string; module: string; slug: string }>;

export type FaqCategoriesActions = {
  create: (input: CreateCategoryInput) => Promise<Done>;
  update: (input: UpdateCategoryInput) => Promise<Done>;
  setActive: (input: { categoryId: string; active: boolean }) => Promise<Done>;
  remove: (input: { categoryId: string }) => Promise<Done>;
};

type FaqCategoriesPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The categories of the FAQ list, hidden ones too, in the admin's order. */
  categories: CategoryView[];
  /** How many questions (the Trash too) each category holds, by category id. */
  usage: Record<string, number>;
  actions: FaqCategoriesActions;
};

const EMPTY: CategoryFormValues = { name: "", slug: "", active: true };
type FormErrors = { name?: string; slug?: string; form?: string };

/**
 * The drawer where the admin manages the FAQ's categories (ADR-143, FR-ADM-14 and FR-ADM-15): add, rename, hide or show,
 * put in order and delete, through the shared CategoryManager. The address word is suggested from the name until the
 * admin types their own. A category that still holds questions (the Trash counts) cannot be deleted, and the drawer says
 * why; the database refuses it too. Putting one in order renumbers the whole list, because the saved orders may tie.
 * After each change the page is read again.
 */
export function FaqCategoriesPanel({
  open,
  onOpenChange,
  categories,
  usage,
  actions,
}: FaqCategoriesPanelProps) {
  const translate = useTranslations("admin.faq.categories");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [values, setValues] = useState<CategoryFormValues>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editing = categories.find((category) => category.id === editingId) ?? null;
  const deleting = categories.find((category) => category.id === deleteId) ?? null;

  const reset = () => {
    setValues(EMPTY);
    setSlugTouched(false);
    setEditingId(null);
    setErrors({});
  };

  const report = (failure: Extract<ActionResult<unknown>, { ok: false }>) => {
    notify.error(
      failure.code === "NOT_FOUND" || failure.code === "CONFLICT"
        ? translate("conflict")
        : failureText(everything, failure),
    );
    router.refresh();
  };

  /** Puts a failure's messages on their boxes (or the whole form); false when nothing could be placed. */
  const showErrors = (failure: Extract<ActionResult<unknown>, { ok: false }>): boolean => {
    const next: FormErrors = {};
    for (const [field, problems] of Object.entries(failure.fieldErrors ?? {})) {
      const first = problems[0];
      if (!first) continue;
      const text = fieldErrorText(everything, first);
      if (field === "name") next.name = text;
      else if (field === "slug") next.slug = text;
      else next.form = text;
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const change = (next: CategoryFormValues) => {
    // Typing in the address box takes it over from the name; until then it follows the name when adding.
    if (next.slug !== values.slug) setSlugTouched(true);
    const follows = editingId === null && !slugTouched && next.slug === values.slug;
    setValues(follows ? { ...next, slug: slugFromName(next.name, CATEGORY_SLUG_MAX) } : next);
    setErrors({});
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = editing
        ? await actions.update({
            categoryId: editing.id,
            name: values.name,
            slug: values.slug,
            sortOrder: editing.sortOrder,
            active: values.active,
          })
        : await actions.create({
            module: "faq",
            name: values.name,
            slug: values.slug,
            sortOrder: categories.length + 1,
            active: values.active,
          });
      if (!result.ok) {
        if (!showErrors(result)) report(result);
        return;
      }
      notify.success(translate(editing ? "toast.saved" : "toast.created"));
      reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const toggle = async (category: CategoryView) => {
    if (pending) return;
    setPending(true);
    try {
      const result = await actions.setActive({ categoryId: category.id, active: !category.active });
      if (!result.ok) return report(result);
      notify.success(translate(category.active ? "toast.hidden" : "toast.shown"));
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  /** Swaps a category with its neighbour and numbers the whole list 1, 2, 3, saving only the ones that changed. */
  const move = async (category: CategoryView, step: -1 | 1) => {
    if (pending) return;
    const list = [...categories];
    const index = list.findIndex((one) => one.id === category.id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target] as CategoryView, list[index] as CategoryView];
    setPending(true);
    try {
      for (const [position, one] of list.entries()) {
        if (one.sortOrder === position + 1) continue;
        const result = await actions.update({
          categoryId: one.id,
          name: one.name,
          slug: one.slug,
          sortOrder: position + 1,
          active: one.active,
        });
        if (!result.ok) return report(result);
      }
      notify.success(translate("toast.moved"));
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!deleting || pending) return;
    setPending(true);
    try {
      const result = await actions.remove({ categoryId: deleting.id });
      if (!result.ok) return report(result);
      notify.success(translate("toast.deleted"));
      if (editingId === deleting.id) reset();
      router.refresh();
    } finally {
      setPending(false);
      setDeleteId(null);
    }
  };

  const rows: CategoryRow[] = categories.map((category, index) => {
    const used = usage[category.id] ?? 0;
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      usage: translate("usage", { count: used }),
      hidden: !category.active,
      hiddenLabel: translate("hidden"),
      editing: category.id === editingId,
      edit: {
        label: translate("rows.edit", { name: category.name }),
        onClick: () => {
          setEditingId(category.id);
          setValues({ name: category.name, slug: category.slug, active: category.active });
          setSlugTouched(true);
          setErrors({});
        },
      },
      toggle: {
        label: translate(category.active ? "rows.hide" : "rows.show", { name: category.name }),
        onClick: () => void toggle(category),
        hide: category.active,
      },
      remove: {
        label: translate("rows.delete", { name: category.name }),
        onClick: () => setDeleteId(category.id),
        ...(used > 0 ? { disabled: true, reason: translate("inUse") } : {}),
      },
      moveUp: {
        label: translate("rows.up", { name: category.name }),
        onClick: () => void move(category, -1),
        disabled: index === 0,
      },
      moveDown: {
        label: translate("rows.down", { name: category.name }),
        onClick: () => void move(category, 1),
        disabled: index === categories.length - 1,
      },
    };
  });

  return (
    <>
      <ManagerDrawer
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) reset();
        }}
        title={translate("title")}
        description={translate("description")}
        closeLabel={translate("close")}
        cancelLabel={translate("close")}
      >
        <CategoryManager
          rows={rows}
          listLabel={translate("listLabel")}
          emptyText={translate("empty")}
          form={{
            title: editing
              ? translate("form.editTitle", { name: editing.name })
              : translate("form.addTitle"),
            values,
            errors,
            onChange: change,
            onSubmit: () => void submit(),
            pending,
            ...(editing ? { onCancel: reset } : {}),
            words: {
              name: translate("form.name"),
              slug: translate("form.slug"),
              slugHint: translate("form.slugHint"),
              active: translate("form.active"),
              activeHint: translate("form.activeHint"),
              submit: translate(editing ? "form.save" : "form.add"),
              cancel: translate("form.cancel"),
            },
          }}
        />
      </ManagerDrawer>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => (next ? undefined : setDeleteId(null))}
        tone="danger"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title={translate("delete.title", { name: deleting?.name ?? "" })}
        description={translate("delete.text")}
        confirmLabel={translate("delete.confirm")}
        cancelLabel={translate("delete.cancel")}
        loading={pending}
        onConfirm={() => void remove()}
      />
    </>
  );
}
