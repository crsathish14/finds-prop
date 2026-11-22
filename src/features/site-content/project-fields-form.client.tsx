"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Heading } from "@/components/ui/heading";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { PROJECT_FIELDS_MAX, PROJECT_FIELD_HINT_MAX, PROJECT_FIELD_LABEL_MAX } from "./constants";
import type { Problems } from "./form";
import { useSaveFlow, useScrollToProblems, type SaveContent } from "./save-flow.client";

/** The property types a box can be limited to, in the order the project form offers them. */
export const FIELD_PROPERTY_TYPES = [
  "apartment",
  "villa",
  "plot",
  "vacant_land",
  "flat",
  "office",
  "co_working",
] as const;
export type FieldPropertyType = (typeof FIELD_PROPERTY_TYPES)[number];

export type ProjectFieldRow = {
  id: string;
  label: string;
  hint: string;
  required: boolean;
  appliesTo: FieldPropertyType[];
  on: boolean;
};

export type ProjectFieldsFormProps = {
  /** The boxes as saved, in order. */
  initial: ProjectFieldRow[];
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

/** The id of one control of a row, unique on the page. */
const partId = (row: { id: string }, part: string) => [row.id, part].join("-");

/** A new id: lower case letters and digits, never reused, so the answers stored under it stay with this box. */
const newId = () => `f${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

/**
 * The admin's Project form boxes page (ADR-168): the extra plain-text boxes builders see on the project form. Each box has
 * a label, a hint, a required switch, the property types it is asked for (none ticked means every type) and an on
 * switch. The list keeps up to ten boxes, in the order shown. It keeps what is typed, sends the whole list to the save
 * action and puts the server's problems on the boxes they belong to; Discard puts the list back to what was loaded.
 */
export function ProjectFieldsForm({ initial, save }: ProjectFieldsFormProps) {
  const translate = useTranslations("admin.projectFields");
  const siteContent = useTranslations("admin.siteContent");
  const flow = useSaveFlow(save, {
    title: translate("saved.title"),
    text: translate("saved.text"),
  });
  const [rows, setRows] = useState<ProjectFieldRow[]>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const change = (index: number, patch: Partial<ProjectFieldRow>) =>
    setRows(rows.map((row, place) => (place === index ? { ...row, ...patch } : row)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [taken] = next.splice(index, 1);
    if (!taken) return;
    next.splice(index + by, 0, taken);
    setRows(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(
      await flow.submit({
        fields: rows.map((row) => ({
          id: row.id,
          label: row.label,
          hint: row.hint,
          required: row.required,
          appliesTo: row.appliesTo,
          on: row.on,
        })),
      }),
    );
  };

  const count = Object.keys(problems).length;
  const typeName = (kind: FieldPropertyType) => {
    switch (kind) {
      case "apartment":
        return translate("types.apartment");
      case "villa":
        return translate("types.villa");
      case "plot":
        return translate("types.plot");
      case "vacant_land":
        return translate("types.vacantLand");
      case "flat":
        return translate("types.flat");
      case "office":
        return translate("types.office");
      case "co_working":
        return translate("types.coWorking");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("description", { max: PROJECT_FIELDS_MAX })}</Text>
      </header>
      {count > 0 ? (
        <div ref={alertAt} tabIndex={-1}>
          <Alert tone="danger" title={siteContent("problems.title", { count })}>
            {siteContent("problems.text")}
          </Alert>
        </div>
      ) : null}
      {rows.length === 0 ? <Text tone="muted">{translate("empty")}</Text> : null}
      <ol className="flex flex-col gap-4">
        {rows.map((row, index) => {
          const labelProblem = problems[`fields.${index}.label`];
          const hintProblem = problems[`fields.${index}.hint`];
          return (
            <li
              key={row.id}
              data-slot="project-field-row"
              className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Heading as="h2" size="3">
                  {translate("row", { number: index + 1 })}
                </Heading>
                <div className="flex gap-1">
                  <IconButton
                    type="button"
                    aria-label={translate("moveUp", { number: index + 1 })}
                    disabled={flow.saving || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={translate("moveDown", { number: index + 1 })}
                    disabled={flow.saving || index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={translate("remove", { number: index + 1 })}
                    disabled={flow.saving}
                    onClick={() => setRows(rows.filter((_, place) => place !== index))}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
              <FormField
                label={translate("label")}
                required
                {...(labelProblem ? { error: labelProblem } : {})}
              >
                <Input
                  value={row.label}
                  maxLength={PROJECT_FIELD_LABEL_MAX}
                  disabled={flow.saving}
                  onChange={(event) => change(index, { label: event.target.value })}
                />
              </FormField>
              <FormField
                label={translate("hint")}
                optionalLabel={siteContent("optional")}
                hint={translate("hintNote", { max: PROJECT_FIELD_HINT_MAX })}
                {...(hintProblem ? { error: hintProblem } : {})}
              >
                <Input
                  value={row.hint}
                  maxLength={PROJECT_FIELD_HINT_MAX}
                  disabled={flow.saving}
                  onChange={(event) => change(index, { hint: event.target.value })}
                />
              </FormField>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-small font-bold text-ink">{translate("appliesTo")}</legend>
                <Text variant="small" tone="muted">
                  {translate("appliesToNote")}
                </Text>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {FIELD_PROPERTY_TYPES.map((kind) => {
                    const id = partId(row, kind);
                    return (
                      <div key={kind} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={row.appliesTo.includes(kind)}
                          disabled={flow.saving}
                          onCheckedChange={(on) =>
                            change(index, {
                              appliesTo:
                                on === true
                                  ? [...row.appliesTo, kind]
                                  : row.appliesTo.filter((other) => other !== kind),
                            })
                          }
                        />
                        <Label htmlFor={id}>{typeName(kind)}</Label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id={partId(row, "required")}
                    checked={row.required}
                    disabled={flow.saving}
                    onCheckedChange={(required) => change(index, { required })}
                  />
                  <Label htmlFor={partId(row, "required")}>{translate("required")}</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id={partId(row, "on")}
                    checked={row.on}
                    disabled={flow.saving}
                    onCheckedChange={(on) => change(index, { on })}
                  />
                  <Label htmlFor={partId(row, "on")}>{translate("on")}</Label>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="secondary"
          iconStart={<Plus aria-hidden="true" />}
          disabled={flow.saving || rows.length >= PROJECT_FIELDS_MAX}
          onClick={() =>
            setRows([
              ...rows,
              { id: newId(), label: "", hint: "", required: false, appliesTo: [], on: true },
            ])
          }
        >
          {translate("add")}
        </Button>
        {rows.length >= PROJECT_FIELDS_MAX ? (
          <Text variant="small" tone="muted">
            {translate("full", { max: PROJECT_FIELDS_MAX })}
          </Text>
        ) : null}
      </div>
      <ProjectSaveBar
        note={translate("saveNote")}
        words={{
          cancel: siteContent("save.cancel"),
          save: siteContent("save.save"),
          saving: siteContent("save.saving"),
        }}
        saving={flow.saving}
        onCancel={() => {
          setRows(initial);
          setProblems(NO_PROBLEMS);
        }}
      />
    </form>
  );
}
