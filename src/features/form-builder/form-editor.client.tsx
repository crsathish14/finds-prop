"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  FormFieldsEditor,
  type FormFieldDraft,
  type FormFieldsWords,
} from "@/components/domain/form-fields-editor";
import { FormPreview } from "@/components/domain/form-preview";
import {
  FormSettingsFields,
  type FormSettingsField,
  type FormSettingsValues,
  type FormSettingsWords,
} from "@/components/domain/form-settings-fields";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { Heading } from "@/components/ui/heading";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { FIELD_COUNT_MAX } from "./constants";
import {
  NO_PROBLEMS,
  QUICK_ADD_IDS,
  blankDraft,
  countProblems,
  draftOfField,
  duplicateKeyProblems,
  firstFieldWithProblem,
  freeKey,
  keyFromLabel,
  payloadOf,
  presetDraft,
  previewFieldsOf,
  problemsOf,
  settingsOfForm,
  slugFromName,
  type EditorProblems,
  without,
  type QuickAddId,
} from "./form-draft";
import type { AdminFormView } from "./view";

type FormEditorProps = {
  /** The form being changed, or none for a new one. */
  form: AdminFormView | null;
  projects: { id: string; name: string }[];
  integrations: { id: string; name: string }[];
  /** The kinds, placements and field types the forms feature knows (passed in by the page, which may read them). */
  lists: { kinds: readonly string[]; placements: readonly string[]; types: readonly string[] };
  /** Makes a form (when `form` is none) or saves changes to it. */
  save: (input: Record<string, unknown>) => Promise<ActionResult<{ formId: string; slug: string }>>;
};

/**
 * The admin's form editor (S7-T08, FR-ADM-08): the Settings boxes, the Fields editor and the live preview beside it,
 * with the save bar. It keeps what is typed (the boxes, which field is open, the problems), sends it to the save
 * action and puts what the server says is wrong on the boxes it belongs to. A new form's slug follows its name and a
 * new field's key follows its label until the admin types their own; a saved field's key never changes by itself.
 * A key used twice is caught before sending. After a change to a form that exists the page is read again; a new form
 * opens on its own page once it is made.
 */
export function FormEditor({ form, projects, integrations, lists, save }: FormEditorProps) {
  const translate = useTranslations("admin.forms.editor");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const isNew = form === null;
  const [settings, setSettings] = useState<FormSettingsValues>(() => settingsOfForm(form));
  const [drafts, setDrafts] = useState<FormFieldDraft[]>(() =>
    (form?.fields ?? []).map((field, index) => draftOfField(field, `f${index}`)),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [problems, setProblems] = useState<EditorProblems>(NO_PROBLEMS);
  const [saving, setSaving] = useState(false);
  const [followName, setFollowName] = useState(isNew);
  const [followLabel, setFollowLabel] = useState<ReadonlySet<string>>(new Set());
  const counter = useRef(0);
  const alertAt = useRef<HTMLDivElement>(null);

  const total = countProblems(problems);
  useEffect(() => {
    if (total > 0) alertAt.current?.scrollIntoView?.({ block: "start" });
  }, [problems, total]);

  const newId = () => {
    counter.current += 1;
    return `n${counter.current}`;
  };

  const changeSetting = (field: FormSettingsField, value: string | boolean) => {
    setProblems((previous) => {
      if (previous.settings[field] === undefined) return previous;
      return { ...previous, settings: without(previous.settings, field) };
    });
    setSettings((previous) => {
      if (field === "active") return { ...previous, active: value === true };
      const text = String(value);
      const next = { ...previous, [field]: text };
      if (field === "name" && followName) next.slug = slugFromName(text);
      return next;
    });
    if (field === "slug") setFollowName(false);
  };

  const changeField = (
    id: string,
    box: keyof Omit<FormFieldDraft, "id">,
    value: string | boolean,
  ) => {
    setProblems((previous) => {
      const own = previous.fields[id];
      if (own === undefined || !(box in own)) return previous;
      return { ...previous, fields: { ...previous.fields, [id]: without(own, box) } };
    });
    setDrafts((previous) =>
      previous.map((draft) => {
        if (draft.id !== id) return draft;
        const next = { ...draft, [box]: value };
        if (box === "label" && followLabel.has(id)) next.key = keyFromLabel(String(value));
        return next;
      }),
    );
    if (box === "key") {
      setFollowLabel((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  };

  const addField = () => {
    const id = newId();
    setDrafts((previous) => [...previous, blankDraft(id)]);
    setFollowLabel((previous) => new Set(previous).add(id));
    setOpenId(id);
  };

  const quickAdd = (preset: string) => {
    if (!(QUICK_ADD_IDS as readonly string[]).includes(preset)) return;
    const id = newId();
    const chip = preset as QuickAddId;
    setDrafts((previous) => {
      const made = presetDraft(id, chip, everything(`admin.forms.editor.quickAddChips.${chip}`));
      return [...previous, { ...made, key: freeKey(made.key, previous) }];
    });
  };

  const removeField = (id: string) => {
    setDrafts((previous) => previous.filter((draft) => draft.id !== id));
    setOpenId((current) => (current === id ? null : current));
  };

  const reorder = (ids: string[]) =>
    setDrafts((previous) => ids.flatMap((id) => previous.find((draft) => draft.id === id) ?? []));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const twice = duplicateKeyProblems(drafts, (key) => translate("keyTaken", { key }));
    if (Object.keys(twice).length > 0) {
      const found: EditorProblems = { settings: {}, fields: twice, form: [] };
      setProblems(found);
      setOpenId(firstFieldWithProblem(found, drafts));
      return;
    }

    setSaving(true);
    try {
      const payload = payloadOf(settings, drafts);
      const result = await save(isNew ? payload : { formId: form.id, ...payload });
      if (result.ok) {
        setProblems(NO_PROBLEMS);
        notify.success(translate("saved"));
        if (isNew) router.push(`/admin/forms/${result.data.formId}`);
        else router.refresh();
        return;
      }
      const byPath: Record<string, string> = {};
      for (const [path, list] of Object.entries(result.fieldErrors ?? {})) {
        const first = list[0];
        if (first && byPath[path] === undefined) byPath[path] = fieldErrorText(everything, first);
      }
      const found = problemsOf(byPath, drafts);
      if (countProblems(found) > 0) {
        setProblems(found);
        const open = firstFieldWithProblem(found, drafts);
        if (open) setOpenId(open);
        return;
      }
      notify.error(failureText(everything, result));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const settingsWords: FormSettingsWords = {
    name: translate("settings.name"),
    slug: translate("settings.slug"),
    kind: translate("settings.kind"),
    placement: translate("settings.placement"),
    project: translate("settings.project"),
    projectNotNeeded: translate("settings.projectNotNeeded"),
    projectChoose: translate("settings.projectChoose"),
    crm: translate("settings.crm"),
    crmNone: translate("settings.crmNone"),
    buttonText: translate("settings.buttonText"),
    status: translate("settings.status"),
    active: translate("settings.active"),
    successMessage: translate("settings.successMessage"),
  };

  const fieldWords: FormFieldsWords = {
    title: translate("fields.title"),
    dragHint: translate("fields.dragHint"),
    quickAddLabel: translate("fields.quickAdd"),
    add: translate("fields.add"),
    limitTitle: translate("fields.limitTitle"),
    limitText: translate("fields.limitText"),
    emptyText: translate("fields.empty"),
    label: translate("fields.label"),
    key: translate("fields.key"),
    type: translate("fields.type"),
    placeholder: translate("fields.placeholder"),
    options: translate("fields.options"),
    optionsHint: translate("fields.optionsHint"),
    min: translate("fields.min"),
    max: translate("fields.max"),
    required: translate("fields.required"),
    requiredBadge: translate("fields.requiredBadge"),
    remove: translate("fields.remove"),
    edit: (name) => translate("fields.edit", { name }),
    collapse: (name) => translate("fields.collapse", { name }),
    drag: (name) => translate("fields.drag", { name }),
    moveUp: (name) => translate("fields.moveUp", { name }),
    moveDown: (name) => translate("fields.moveDown", { name }),
    removeField: (name) => translate("fields.removeField", { name }),
    unnamed: translate("fields.unnamed"),
  };

  const title = isNew ? translate("newTitle") : translate("editTitle");
  const skipped = form?.skippedFields ?? 0;

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Breadcrumb
          navLabel={translate("crumb.nav")}
          backLabel={translate("crumb.back")}
          items={[
            { label: translate("crumb.forms"), href: "/admin/forms" },
            { label: isNew ? title : (form?.name ?? title) },
          ]}
        />
        <Heading as="h1" size="1">
          {title}
        </Heading>
      </header>
      {total > 0 ? (
        <div ref={alertAt} tabIndex={-1}>
          <Alert tone="danger" title={translate("problems.title", { count: total })}>
            {translate("problems.text")}
            {problems.form.length > 0 ? (
              <ul className="mt-2 list-disc ps-5">
                {problems.form.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {skipped > 0 ? <Alert tone="info">{translate("skipped", { count: skipped })}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <section
            aria-labelledby="form-settings-title"
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 md:p-6"
          >
            <h2 id="form-settings-title" className="text-title font-bold text-ink">
              {translate("settingsTitle")}
            </h2>
            <FormSettingsFields
              values={settings}
              errors={problems.settings}
              onChange={changeSetting}
              kinds={lists.kinds.map((value) => ({
                value,
                label: everything(`admin.forms.kinds.${value}`),
              }))}
              placements={lists.placements.map((value) => ({
                value,
                label: everything(`admin.forms.placements.${value}`),
              }))}
              projects={projects.map((project) => ({ value: project.id, label: project.name }))}
              integrations={integrations.map((entry) => ({ value: entry.id, label: entry.name }))}
              disabled={saving}
              words={settingsWords}
            />
          </section>
          <FormFieldsEditor
            fields={drafts}
            openId={openId}
            errors={problems.fields}
            types={lists.types.map((value) => ({
              value,
              label: everything(`admin.forms.editor.types.${value}`),
            }))}
            quickAdd={QUICK_ADD_IDS.map((id) => ({
              id,
              label: everything(`admin.forms.editor.quickAddChips.${id}`),
            }))}
            onChange={changeField}
            onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
            onReorder={reorder}
            onRemove={removeField}
            onAdd={addField}
            onQuickAdd={quickAdd}
            max={FIELD_COUNT_MAX}
            disabled={saving}
            words={fieldWords}
          />
        </div>
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <FormPreview
            label={translate("preview.label")}
            empty={translate("preview.empty")}
            fields={previewFieldsOf(drafts, lists.types)}
            buttonText={settings.buttonText.trim() || undefined}
          />
        </div>
      </div>
      <ProjectSaveBar
        note={translate("save.note")}
        words={{
          cancel: translate("save.cancel"),
          save: translate("save.save"),
          saving: translate("save.saving"),
        }}
        saving={saving}
        onCancel={() => router.push("/admin/forms")}
      />
    </form>
  );
}
