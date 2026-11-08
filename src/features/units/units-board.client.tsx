"use client";

import { TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UnitForm, type UnitFormValues, type UnitFormWords } from "@/components/domain/unit-form";
import { UnitsManager, type UnitRow } from "@/components/domain/units-manager";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatArea, formatPrice } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { UNIT_FACINGS, UNIT_STATE_FILTERS, UNIT_STATUSES, type UnitStateFilter } from "./constants";
import {
  BADGE_STATUS,
  EMPTY_UNIT_VALUES,
  FACING_KEYS,
  isUnitFormField,
  valuesOfUnit,
} from "./form";
import { unitsHref } from "./href";
import type { ProjectOption, UnitView, UnitsPage } from "./view";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type Done = ActionResult<{ unitId: string; projectId: string; projectSlug: string }>;

export type UnitsBoardActions = {
  add: (input: UnitFormValues & { projectId: string }) => Promise<Done>;
  update: (input: UnitFormValues & { unitId: string }) => Promise<Done>;
  remove: (input: { unitId: string }) => Promise<Done>;
  loadMore: (input: {
    projectId: string;
    state: UnitStateFilter;
    search?: string;
    after: string;
  }) => Promise<ActionResult<UnitsPage>>;
};

type UnitsBoardProps = {
  projects: ProjectOption[];
  /** What the page was read for: the project, the state chip and the unit number looked for. */
  filters: { projectId: string; state: UnitStateFilter; search?: string | undefined };
  page: UnitsPage;
  actions: UnitsBoardActions;
};

type Panel = { kind: "add" } | { kind: "edit"; id: string };
type FormErrors = Partial<Record<keyof UnitFormValues, string>>;

/** How long to wait after the last key before the search is applied. */
const SEARCH_DELAY = 350;

/**
 * The admin's Units page (S7-T07, FR-ADM-05): the heading with Add unit, the choice of project, the search and the
 * state chips, the table, and the drawer and question that go with it. The project, the state and the search are in
 * the address, so the page is read again for them (and the count is right). It calls the four actions it is given and
 * keeps nothing the server does not also know: after each change the page is read again, and "Show more" adds the
 * next units in place.
 */
export function UnitsBoard({ projects, filters, page, actions }: UnitsBoardProps) {
  const translate = useTranslations("admin.units");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [panel, setPanel] = useState<Panel | null>(null);
  const [values, setValues] = useState<UnitFormValues>(EMPTY_UNIT_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [more, setMore] = useState<UnitView[]>([]);
  const [laterCursor, setLaterCursor] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(filters.search ?? "");

  // A page read again (after a change, or for other choices) starts the list over from its first units.
  const [seen, setSeen] = useState(page);
  if (seen !== page) {
    setSeen(page);
    setMore([]);
    setLaterCursor(null);
    setLoadedMore(false);
  }

  // The search is applied a moment after the last key, so each letter does not read the page.
  useEffect(() => {
    const typed = search.trim();
    if (typed === (filters.search ?? "")) return;
    const timer = window.setTimeout(() => {
      router.replace(
        unitsHref({
          projectId: filters.projectId,
          state: filters.state,
          search: typed === "" ? undefined : typed,
        }),
      );
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [search, filters.search, filters.projectId, filters.state, router]);

  const units = [...page.units, ...more];
  const nextCursor = loadedMore ? laterCursor : page.nextCursor;
  const editing = panel?.kind === "edit" ? units.find((unit) => unit.id === panel.id) : undefined;
  const deletingUnit = units.find((unit) => unit.id === deleteId) ?? null;

  const dash = translate("dash");

  const words: UnitFormWords = {
    unitNumber: translate("form.unitNumber"),
    floor: translate("form.floor"),
    bhk: translate("form.bhk"),
    area: translate("form.area"),
    facing: translate("form.facing"),
    price: translate("form.price"),
    status: translate("form.status"),
    availableFrom: translate("form.availableFrom"),
    floorPlanUrl: translate("form.floorPlanUrl"),
    optional: translate("form.optional"),
    notSet: translate("form.notSet"),
    bhkOptions: Array.from({ length: 11 }, (_unused, index) => ({
      value: String(index),
      label: String(index),
    })),
    facingOptions: UNIT_FACINGS.map((facing) => ({
      value: facing,
      label: everything(`admin.units.facing.${FACING_KEYS[facing]}`),
    })),
    statusOptions: UNIT_STATUSES.map((status) => ({
      value: status,
      label: everything(`admin.units.states.${status}`),
    })),
  };

  const openAdd = () => {
    setValues(EMPTY_UNIT_VALUES);
    setErrors({});
    setPanel({ kind: "add" });
  };

  const openEdit = (unit: UnitView) => {
    setValues(valuesOfUnit(unit));
    setErrors({});
    setPanel({ kind: "edit", id: unit.id });
  };

  /** A failure with no box to blame: said in a toast, and the page is read again so it shows the truth. */
  const reportFailure = (failure: Failure) => {
    notify.error(
      failure.code === "CONFLICT" || failure.code === "NOT_FOUND"
        ? translate("conflict")
        : failureText(everything, failure),
    );
    router.refresh();
  };

  /** Puts a failure's field messages on their boxes; true when at least one box got one. */
  const showFieldErrors = (failure: Failure): boolean => {
    const next: FormErrors = {};
    for (const [field, problems] of Object.entries(failure.fieldErrors ?? {})) {
      const first = problems[0];
      if (first && isUnitFormField(field)) next[field] = fieldErrorText(everything, first);
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const change = (field: keyof UnitFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const submit = async () => {
    if (!panel || sending) return;
    setSending(true);
    try {
      const adding = panel.kind === "add";
      const result = adding
        ? await actions.add({ ...values, projectId: filters.projectId })
        : await actions.update({ ...values, unitId: panel.id });
      if (!result.ok) {
        if (!showFieldErrors(result)) reportFailure(result);
        return;
      }
      setPanel(null);
      notify.success(translate(adding ? "toast.added.title" : "toast.saved.title"), {
        description: translate(adding ? "toast.added.text" : "toast.saved.text", {
          number: values.unitNumber.trim(),
        }),
      });
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const remove = async (unit: UnitView) => {
    setDeleting(true);
    const result = await actions.remove({ unitId: unit.id });
    setDeleting(false);
    setDeleteId(null);
    if (!result.ok) {
      reportFailure(result);
      return;
    }
    notify.success(translate("toast.deleted.title"), {
      description: translate("toast.deleted.text", { number: unit.unitNumber }),
    });
    router.refresh();
  };

  const showMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await actions.loadMore({
      projectId: filters.projectId,
      state: filters.state,
      ...(filters.search ? { search: filters.search } : {}),
      after: nextCursor,
    });
    setLoadingMore(false);
    if (!result.ok) {
      notify.error(translate("showMore.failed"));
      return;
    }
    setMore((previous) => [...previous, ...result.data.units]);
    setLaterCursor(result.data.nextCursor);
    setLoadedMore(true);
  };

  const rowOf = (unit: UnitView): UnitRow => ({
    id: unit.id,
    unitNumber: unit.unitNumber,
    floor: unit.floor === null ? dash : String(unit.floor),
    bhk: unit.bhk === null ? dash : everything("property.bhk", { count: unit.bhk }),
    area: unit.areaSqft === null ? dash : formatArea(everything, locale, unit.areaSqft),
    facing: unit.facing ?? dash,
    price: unit.price === null ? dash : formatPrice(everything, locale, unit.price),
    status: <StatusBadge kind="unit" status={BADGE_STATUS[unit.status]} />,
    editLabel: translate("actions.edit"),
    editFor: translate("actions.editFor", { number: unit.unitNumber }),
    onEdit: () => openEdit(unit),
    deleteLabel: translate("actions.delete", { number: unit.unitNumber }),
    onDelete: () => setDeleteId(unit.id),
    pending: deleting && deleteId === unit.id,
  });

  const go = (choice: { projectId: string; state: UnitStateFilter; search?: string | undefined }) =>
    router.push(unitsHref(choice));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <UnitsManager
        title={translate("title")}
        intro={translate("intro")}
        addLabel={translate("actions.add")}
        onAdd={openAdd}
        project={{
          label: translate("project"),
          options: projects.map((project) => ({ value: project.id, label: project.name })),
          value: filters.projectId,
          onChange: (projectId) => go({ projectId, state: "all" }),
        }}
        search={{
          value: search,
          onChange: setSearch,
          label: translate("search.label"),
          placeholder: translate("search.placeholder"),
        }}
        states={{
          label: translate("states.label"),
          options: UNIT_STATE_FILTERS.map((state) => ({
            value: state,
            label: everything(`admin.units.states.${state}`),
          })),
          value: filters.state,
          onChange: (state) =>
            go({
              projectId: filters.projectId,
              state: state as UnitStateFilter,
              search: filters.search,
            }),
        }}
        columns={{
          unit: translate("table.unit"),
          floor: translate("table.floor"),
          bhk: translate("table.bhk"),
          area: translate("table.area"),
          facing: translate("table.facing"),
          price: translate("table.price"),
          status: translate("table.status"),
          actions: translate("table.actions"),
        }}
        caption={translate("table.caption")}
        rows={units.map(rowOf)}
        countText={translate("count", { shown: units.length, total: page.total })}
        note={translate("note")}
        empty={{ title: translate("empty.title"), text: translate("empty.text") }}
      />
      {nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" loading={loadingMore} onClick={showMore}>
            {translate("showMore.button")}
          </Button>
        </div>
      ) : null}
      <ManagerDrawer
        open={panel !== null}
        onOpenChange={(open) => (open ? undefined : setPanel(null))}
        title={translate(panel?.kind === "edit" ? "edit.title" : "add.title")}
        description={translate(panel?.kind === "edit" ? "edit.text" : "add.text")}
        closeLabel={translate("close")}
        cancelLabel={translate("cancel")}
        submitLabel={translate(panel?.kind === "edit" ? "edit.submit" : "add.submit")}
        formId="unit-form"
        pending={sending}
      >
        {panel === null || (panel.kind === "edit" && editing === undefined) ? null : (
          <UnitForm
            id="unit-form"
            values={values}
            errors={errors}
            onChange={change}
            onSubmit={submit}
            disabled={sending}
            words={words}
          />
        )}
      </ManagerDrawer>
      <ConfirmDialog
        open={deletingUnit !== null}
        onOpenChange={(open) => (open ? undefined : setDeleteId(null))}
        tone="danger"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title={translate("delete.title", { number: deletingUnit?.unitNumber ?? "" })}
        description={translate("delete.text")}
        confirmLabel={translate("delete.confirm")}
        cancelLabel={translate("cancel")}
        onConfirm={() => (deletingUnit ? void remove(deletingUnit) : undefined)}
      />
    </div>
  );
}
