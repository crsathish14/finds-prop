"use client";

import { useState } from "react";
import { FormFieldsEditor } from "@/components/domain/form-fields-editor";
import type {
  FormFieldBox,
  FormFieldDraft,
  FormFieldErrors,
  FormFieldsWords,
} from "@/components/domain/form-fields-editor";
import { FormPreview } from "@/components/domain/form-preview";
import {
  FormSettingsFields,
  type FormSettingsField,
  type FormSettingsValues,
  type FormSettingsWords,
} from "@/components/domain/form-settings-fields";
import { FormsManager, type FormRowView } from "@/components/domain/forms-manager";
import { Specimen, Stage } from "../frame";

/**
 * The admin's form builder in its states (S7-T08): the list of forms, the settings box, and the fields box with its
 * live preview. Plain English text; nothing here goes anywhere. The words that are not in the approved admin-forms
 * screen are listed in ADR-105 for the owner to confirm.
 */

const COLUMNS = {
  name: "Name",
  slug: "Slug",
  fields: "Fields",
  placement: "Placement",
  crm: "CRM",
  active: "Active",
  actions: "Actions",
};

type Seed = {
  id: string;
  name: string;
  kind: string;
  slug: string;
  fields: number;
  placement: string;
  crm: string;
  active: boolean;
};

const SEEDS: Seed[] = [
  {
    id: "1",
    name: "Standard enquiry form",
    kind: "Enquiry",
    slug: "enquiry",
    fields: 4,
    placement: "None (fallback)",
    crm: "Not linked",
    active: true,
  },
  {
    id: "2",
    name: "Contact",
    kind: "Contact",
    slug: "contact",
    fields: 5,
    placement: "Contact page",
    crm: "Sample CRM",
    active: true,
  },
  {
    id: "3",
    name: "Kadal Vista site visit",
    kind: "Site visit",
    slug: "kadal-vista-visit",
    fields: 6,
    placement: "Kadal Vista only",
    crm: "Sample CRM",
    active: true,
  },
  {
    id: "4",
    name: "Brochure download",
    kind: "Brochure",
    slug: "brochure",
    fields: 3,
    placement: "All projects",
    crm: "Not linked",
    active: false,
  },
];

function Manager({ seeds, copying, count }: { seeds: Seed[]; copying?: string; count?: string }) {
  const [active, setActive] = useState<Record<string, boolean>>(
    Object.fromEntries(seeds.map((seed) => [seed.id, seed.active])),
  );
  const rows: FormRowView[] = seeds.map((seed) => ({
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    slug: seed.slug,
    fields: seed.fields,
    placement: seed.placement,
    crm: seed.crm,
    active: {
      checked: active[seed.id] ?? false,
      onChange: (checked) => setActive((previous) => ({ ...previous, [seed.id]: checked })),
      label: `Active: ${seed.name}`,
    },
    edit: { href: "#", label: "Edit", forName: seed.name },
    duplicate: {
      label: "Duplicate",
      forName: seed.name,
      onClick: () => undefined,
      pending: copying === seed.id,
    },
    remove: { label: `Delete ${seed.name}`, onClick: () => undefined },
  }));
  return (
    <FormsManager
      title="Forms"
      intro="Forms shown on project pages and the contact page."
      newLabel="New form"
      newHref="#"
      caption="Forms"
      columns={COLUMNS}
      rows={rows}
      countText={count ?? `${rows.length} forms`}
      empty={{
        title: "No forms yet",
        text: "Make a form to show on the contact page or a project page.",
      }}
    />
  );
}

export function FormsManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The Forms page: four forms, one of them off (try the Active switches)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Manager seeds={SEEDS} />
        </Stage>
      </Specimen>
      <Specimen label="A form being copied, and a very long name and slug" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Manager
            copying="2"
            seeds={[
              ...SEEDS.slice(1, 2),
              {
                id: "9",
                name: "Request for a site visit to the Kadal Vista show apartments on a weekend morning",
                kind: "Site visit",
                slug: "kadal-vista-weekend-morning-site-visit-request-form-for-the-omr-corridor",
                fields: 12,
                placement: "Kadal Vista only",
                crm: "A CRM with a rather long name",
                active: true,
              },
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen label="Nothing yet" className="w-full">
        <Stage tone="canvas" className="w-full">
          <Manager seeds={[]} />
        </Stage>
      </Specimen>
    </div>
  );
}

const SETTINGS_WORDS: FormSettingsWords = {
  name: "Name",
  slug: "Slug",
  kind: "Kind",
  placement: "Placement",
  project: "Project",
  projectNotNeeded: "Not needed for this placement",
  projectChoose: "Choose a project",
  crm: "CRM integration",
  crmNone: "Not linked",
  buttonText: "Button text",
  status: "Status",
  active: "Active",
  successMessage: "Success message",
};

const KINDS = [
  { value: "enquiry", label: "Enquiry" },
  { value: "site_visit", label: "Site visit" },
  { value: "brochure", label: "Brochure" },
  { value: "callback", label: "Callback" },
  { value: "contact", label: "Contact" },
  { value: "whatsapp", label: "WhatsApp" },
];
const PLACEMENTS = [
  { value: "none", label: "None" },
  { value: "project", label: "Project pages" },
  { value: "project_specific", label: "One project" },
  { value: "contact", label: "Contact page" },
];
const PROJECTS = [
  { value: "vista", label: "Kadal Vista" },
  { value: "courts", label: "Kadal Courts" },
];
const INTEGRATIONS = [{ value: "crm", label: "Sample CRM" }];

const CONTACT: FormSettingsValues = {
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  projectId: "",
  crmIntegrationId: "crm",
  buttonText: "Send message",
  successMessage: "Thank you, we have your message.",
  active: true,
};

function Settings({
  start,
  errors,
  disabled,
}: {
  start: FormSettingsValues;
  errors?: Partial<Record<FormSettingsField, string>>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(start);
  return (
    <FormSettingsFields
      values={values}
      {...(errors ? { errors } : {})}
      {...(disabled ? { disabled } : {})}
      onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
      kinds={KINDS}
      placements={PLACEMENTS}
      projects={PROJECTS}
      integrations={INTEGRATIONS}
      words={SETTINGS_WORDS}
    />
  );
}

export function FormSettingsFieldsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Filled in for the contact form (the Project box is off: not needed)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Settings start={CONTACT} />
        </Stage>
      </Specimen>
      <Specimen label="For one project: the Project box is on and needed (change Placement to see it)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Settings
            start={{
              ...CONTACT,
              name: "Kadal Vista site visit",
              slug: "kadal-vista-visit",
              kind: "site_visit",
              placement: "project_specific",
              projectId: "vista",
            }}
          />
        </Stage>
      </Specimen>
      <Specimen label="With errors: a project not chosen and a slug already used">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Settings
            start={{
              ...CONTACT,
              slug: "enquiry",
              placement: "project_specific",
              crmIntegrationId: "",
            }}
            errors={{
              slug: "This slug is already used by another form.",
              projectId: "Choose the project this form is for.",
            }}
          />
        </Stage>
      </Specimen>
      <Specimen label="While saving (every box off)">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Settings start={CONTACT} disabled />
        </Stage>
      </Specimen>
    </div>
  );
}

const FIELD_WORDS: FormFieldsWords = {
  title: "Fields",
  dragHint: "Drag to reorder, or use the move buttons",
  quickAddLabel: "Quick add",
  add: "Add field",
  limitTitle: "This form has the most fields it can hold",
  limitText: "Remove a field to add another.",
  emptyText: "No fields yet. Add one, or use a quick add.",
  label: "Label",
  key: "Key",
  type: "Type",
  placeholder: "Placeholder",
  options: "Choices",
  optionsHint: "One choice on each line.",
  min: "Smallest",
  max: "Largest",
  required: "Required",
  requiredBadge: "required",
  remove: "Remove",
  edit: (name) => `Edit field ${name}`,
  collapse: (name) => `Collapse field ${name}`,
  drag: (name) => `Drag field ${name}`,
  moveUp: (name) => `Move field ${name} up`,
  moveDown: (name) => `Move field ${name} down`,
  removeField: (name) => `Remove field ${name}`,
  unnamed: "New field",
};

const TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "file", label: "File" },
];

const QUICK = [
  { id: "name", label: "Name" },
  { id: "mobile", label: "Mobile" },
  { id: "email", label: "Email" },
  { id: "city", label: "City" },
  { id: "budget", label: "Budget" },
  { id: "bhk", label: "BHK" },
];

const draft = (
  id: string,
  label: string,
  key: string,
  type: string,
  extra: Partial<FormFieldDraft> = {},
): FormFieldDraft => ({
  id,
  label,
  key,
  type,
  placeholder: "",
  options: "",
  min: "",
  max: "",
  required: false,
  ...extra,
});

const CONTACT_FIELDS: FormFieldDraft[] = [
  draft("a", "Name", "name", "text", { required: true, placeholder: "Your name" }),
  draft("b", "Mobile", "mobile", "text", { required: true, placeholder: "98400 12345" }),
  draft("c", "Email", "email", "email", { placeholder: "you@example.com" }),
  draft("d", "Message", "message", "textarea", { placeholder: "How can we help?", max: "1000" }),
];

function Editor({
  start,
  open,
  errors,
  max = 30,
  disabled,
  preview = true,
}: {
  start: FormFieldDraft[];
  open?: string;
  errors?: Record<string, FormFieldErrors>;
  max?: number;
  disabled?: boolean;
  preview?: boolean;
}) {
  const [fields, setFields] = useState(start);
  const [openId, setOpenId] = useState<string | null>(open ?? null);
  const change = (id: string, box: keyof Omit<FormFieldDraft, "id">, value: string | boolean) =>
    setFields((previous) =>
      previous.map((field) => (field.id === id ? { ...field, [box]: value } : field)),
    );
  const editor = (
    <FormFieldsEditor
      fields={fields}
      openId={openId}
      {...(errors ? { errors } : {})}
      types={TYPES}
      quickAdd={QUICK}
      onChange={(id, box: FormFieldBox | keyof Omit<FormFieldDraft, "id">, value) =>
        change(id, box, value)
      }
      onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
      onReorder={(ids) =>
        setFields((previous) =>
          ids.flatMap((id) => previous.find((field) => field.id === id) ?? []),
        )
      }
      onRemove={(id) => setFields((previous) => previous.filter((field) => field.id !== id))}
      onAdd={() => {
        const id = `n${fields.length}${Date.now()}`;
        setFields((previous) => [...previous, draft(id, "", "", "text")]);
        setOpenId(id);
      }}
      onQuickAdd={(preset) =>
        setFields((previous) => [
          ...previous,
          draft(`q${previous.length}${preset}`, preset, preset.toLowerCase(), "text"),
        ])
      }
      max={max}
      {...(disabled ? { disabled } : {})}
      words={FIELD_WORDS}
    />
  );
  if (!preview) return editor;
  return (
    <div className="grid w-full gap-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">{editor}</div>
      <FormPreview
        label="Live preview (read only)"
        empty="Add a field to see the form."
        buttonText="Send message"
        fields={fields
          .filter((field) => field.label.trim() !== "")
          .map((field) => ({
            label: field.label,
            key: field.key || field.id,
            type: field.type as "text",
            placeholder: field.placeholder || undefined,
            options: field.options ? field.options.split("\n").filter(Boolean) : undefined,
            required: field.required,
          }))}
      />
    </div>
  );
}

export function FormFieldsEditorDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The editor with its live preview: the second field is open (try the boxes, the arrows, a quick add and Add field)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Editor start={CONTACT_FIELDS} open="b" />
        </Stage>
      </Specimen>
      <Specimen
        label="A choice field open (a dropdown with its choices), and a number with a smallest and a largest"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Editor
            preview={false}
            open="c"
            start={[
              draft("a", "Name", "name", "text", { required: true }),
              draft("b", "Budget", "budget", "number", { min: "10", max: "500" }),
              draft("c", "City", "city", "dropdown", {
                options: "Chennai\nMadurai\nCoimbatore",
                placeholder: "Choose a city",
              }),
            ]}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="With errors: a key used twice, and a dropdown with no choices"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Editor
            preview={false}
            open="second"
            start={[
              draft("first", "Name", "name", "text", { required: true }),
              draft("second", "Mobile", "name", "text", { required: true }),
              draft("third", "City", "city", "dropdown"),
            ]}
            errors={{
              second: { key: "This key is already used by another field." },
              third: { options: "Add at least one choice." },
            }}
          />
        </Stage>
      </Specimen>
      <Specimen
        label="At the limit (four fields here): Add field and the quick adds are off"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full max-w-3xl">
          <Editor preview={false} start={CONTACT_FIELDS} max={4} />
        </Stage>
      </Specimen>
      <Specimen label="No fields yet, and while saving (every box off)" className="w-full">
        <Stage tone="canvas" className="w-full max-w-3xl">
          <div className="flex flex-col gap-6">
            <Editor preview={false} start={[]} />
            <Editor preview={false} start={CONTACT_FIELDS} open="a" disabled />
          </div>
        </Stage>
      </Specimen>
    </div>
  );
}
