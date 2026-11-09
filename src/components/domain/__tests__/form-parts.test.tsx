// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import {
  FormFieldsEditor,
  type FormFieldDraft,
  type FormFieldsEditorProps,
  type FormFieldsWords,
} from "../form-fields-editor";
import { FormPreview } from "../form-preview";
import {
  FormSettingsFields,
  type FormSettingsValues,
  type FormSettingsWords,
} from "../form-settings-fields";
import { FormsManager, type FormRowView } from "../forms-manager";

const COLUMNS = {
  name: "Name",
  slug: "Slug",
  fields: "Fields",
  placement: "Placement",
  crm: "CRM",
  active: "Active",
  actions: "Actions",
};

function row(extra: Partial<FormRowView> = {}): FormRowView {
  return {
    id: "1",
    name: "Contact",
    kind: "Contact",
    slug: "contact",
    fields: 5,
    placement: "Contact page",
    crm: "Sample CRM",
    active: { checked: true, onChange: vi.fn(), label: "Active: Contact" },
    edit: { href: "/admin/forms/1", label: "Edit", forName: "Contact" },
    duplicate: { label: "Duplicate", forName: "Contact", onClick: vi.fn() },
    remove: { label: "Delete Contact", onClick: vi.fn() },
    ...extra,
  };
}

function manager(rows: FormRowView[]) {
  renderWithMessages(
    <FormsManager
      title="Forms"
      intro="Forms shown on project pages and the contact page."
      newLabel="New form"
      newHref="/admin/forms/new"
      caption="Forms"
      columns={COLUMNS}
      rows={rows}
      countText={`${rows.length} forms`}
      empty={{ title: "No forms yet", text: "Make a form." }}
    />,
  );
}

describe("FormsManager: the admin's list of forms (S7-T08)", () => {
  it("shows the heading, New form as a link, and a row with its name, kind, slug, fields, placement and CRM", () => {
    manager([row()]);
    expect(screen.getByRole("heading", { level: 1, name: "Forms" })).toBeVisible();
    expect(screen.getByRole("link", { name: "New form" })).toHaveAttribute(
      "href",
      "/admin/forms/new",
    );
    const table = screen.getByRole("table", { name: "Forms" });
    expect(within(table).getByText("Contact", { selector: "p.font-bold" })).toBeVisible();
    expect(within(table).getByText("contact", { selector: "code" })).toBeVisible();
    expect(within(table).getByText("5")).toBeVisible();
    expect(within(table).getByText("Contact page")).toBeVisible();
    expect(within(table).getByText("Sample CRM")).toBeVisible();
    expect(screen.getByText("1 forms")).toBeVisible();
  });

  it("switches a form with its Active switch, and says which form it is for", () => {
    const onChange = vi.fn();
    manager([row({ active: { checked: true, onChange, label: "Active: Contact" } })]);
    const box = screen.getByRole("switch", { name: "Active: Contact" });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("links Edit to the form, and calls Duplicate and Delete with the form named", () => {
    const duplicate = vi.fn();
    const remove = vi.fn();
    manager([
      row({
        duplicate: { label: "Duplicate", forName: "Contact", onClick: duplicate },
        remove: { label: "Delete Contact", onClick: remove },
      }),
    ]);
    expect(screen.getByRole("link", { name: "Edit Contact" })).toHaveAttribute(
      "href",
      "/admin/forms/1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Contact" }));
    expect(duplicate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete Contact" }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("shows the empty page with New form instead of an empty table", () => {
    manager([]);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No forms yet")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "New form" }).length).toBeGreaterThanOrEqual(1);
  });

  it("turns Duplicate into a working button while a copy is being made", () => {
    manager([
      row({
        duplicate: { label: "Duplicate", forName: "Contact", onClick: vi.fn(), pending: true },
      }),
    ]);
    expect(screen.getByRole("button", { name: "Duplicate Contact" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

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

const VALUES: FormSettingsValues = {
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  projectId: "",
  crmIntegrationId: "",
  buttonText: "Send message",
  successMessage: "Thank you.",
  active: true,
};

function settings(
  extra: Partial<Parameters<typeof FormSettingsFields>[0]> = {},
  values: Partial<FormSettingsValues> = {},
) {
  const onChange = vi.fn();
  renderWithMessages(
    <FormSettingsFields
      values={{ ...VALUES, ...values }}
      onChange={onChange}
      kinds={[
        { value: "enquiry", label: "Enquiry" },
        { value: "contact", label: "Contact" },
      ]}
      placements={[
        { value: "none", label: "None" },
        { value: "project_specific", label: "One project" },
        { value: "contact", label: "Contact page" },
      ]}
      projects={[{ value: "vista", label: "Kadal Vista" }]}
      integrations={[{ value: "crm", label: "Sample CRM" }]}
      words={SETTINGS_WORDS}
      {...extra}
    />,
  );
  return onChange;
}

describe("FormSettingsFields: the Settings box of the form editor (S7-T08)", () => {
  it("shows every box with its value, required marks on the name and slug", () => {
    settings();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Contact");
    expect(screen.getByLabelText(/^Slug/)).toHaveValue("contact");
    expect(screen.getByLabelText("Kind")).toHaveValue("contact");
    expect(screen.getByLabelText("Placement")).toHaveValue("contact");
    expect(screen.getByLabelText("Button text")).toHaveValue("Send message");
    expect(screen.getByLabelText("Success message")).toHaveValue("Thank you.");
    expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
  });

  it("turns the Project box off, saying why, unless the placement is one project", () => {
    settings();
    const box = screen.getByLabelText("Project");
    expect(box).toBeDisabled();
    expect(
      within(box).getByRole("option", { name: "Not needed for this placement" }),
    ).toBeVisible();
  });

  it("turns the Project box on, with the projects to choose, for one project", () => {
    settings({}, { placement: "project_specific" });
    const box = screen.getByLabelText(/^Project/);
    expect(box).toBeEnabled();
    expect(within(box).getByRole("option", { name: "Choose a project" })).toBeVisible();
    expect(within(box).getByRole("option", { name: "Kadal Vista" })).toBeVisible();
  });

  it("offers Not linked first in the CRM box and tells the page what changed", () => {
    const onChange = settings();
    const crm = screen.getByLabelText("CRM integration");
    expect(within(crm).getAllByRole("option")[0]).toHaveTextContent("Not linked");
    fireEvent.change(crm, { target: { value: "crm" } });
    expect(onChange).toHaveBeenCalledWith("crmIntegrationId", "crm");
    fireEvent.change(screen.getByLabelText(/^Slug/), { target: { value: "contact-us" } });
    expect(onChange).toHaveBeenCalledWith("slug", "contact-us");
    fireEvent.click(screen.getByRole("switch", { name: "Active" }));
    expect(onChange).toHaveBeenCalledWith("active", false);
  });

  it("shows an error on its box, and turns every box off while saving", () => {
    settings({ errors: { slug: "This slug is already used by another form." } });
    expect(screen.getByLabelText(/^Slug/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("This slug is already used by another form.")).toBeVisible();
  });

  it("is off while saving", () => {
    settings({ disabled: true });
    expect(screen.getByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getByLabelText("Kind")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Active" })).toBeDisabled();
  });
});

const FIELD_WORDS: FormFieldsWords = {
  title: "Fields",
  dragHint: "Drag to reorder, or use the move buttons",
  quickAddLabel: "Quick add",
  add: "Add field",
  limitTitle: "This form has the most fields it can hold",
  limitText: "Remove a field to add another.",
  emptyText: "No fields yet.",
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

const draft = (
  id: string,
  label: string,
  type: string,
  extra: Partial<FormFieldDraft> = {},
): FormFieldDraft => ({
  id,
  label,
  key: label.toLowerCase(),
  type,
  placeholder: "",
  options: "",
  min: "",
  max: "",
  required: false,
  ...extra,
});

const FIELDS = [
  draft("one", "Name", "text", { required: true }),
  draft("two", "Mobile", "text", { required: true }),
  draft("three", "City", "dropdown", { options: "Chennai\nMadurai" }),
];

function editor(extra: Partial<FormFieldsEditorProps> = {}) {
  const calls = {
    onChange: vi.fn(),
    onToggle: vi.fn(),
    onReorder: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(),
    onQuickAdd: vi.fn(),
  };
  renderWithMessages(
    <FormFieldsEditor
      fields={FIELDS}
      openId={null}
      types={[
        { value: "text", label: "Text" },
        { value: "number", label: "Number" },
        { value: "dropdown", label: "Dropdown" },
        { value: "checkbox", label: "Checkbox" },
        { value: "file", label: "File" },
      ]}
      quickAdd={[
        { id: "name", label: "Name" },
        { id: "mobile", label: "Mobile" },
      ]}
      max={30}
      words={FIELD_WORDS}
      {...calls}
      {...extra}
    />,
  );
  return calls;
}

describe("FormFieldsEditor: the Fields box of the form editor (S7-T08)", () => {
  it("shows a row for each field with its kind and a Required badge, in order, and the quick adds", () => {
    editor();
    expect(screen.getByRole("heading", { name: "Fields" })).toBeVisible();
    const [first, , third] = screen.getAllByRole("listitem");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    if (!first || !third) throw new Error("rows are missing");
    expect(within(first).getByText("Name")).toBeVisible();
    expect(within(first).getByText("Text")).toBeVisible();
    expect(within(first).getByText("required")).toBeVisible();
    expect(within(third).getByText("Dropdown")).toBeVisible();
    expect(within(third).queryByText("required")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Name" })).toBeVisible();
  });

  it("opens a row with its button, which says which field and whether it is open", () => {
    const { onToggle } = editor();
    fireEvent.click(screen.getByRole("button", { name: "Edit field Mobile" }));
    expect(onToggle).toHaveBeenCalledWith("two");
  });

  it("shows the boxes of the open row, with a smallest and largest for text but no choices", () => {
    editor({ openId: "two" });
    expect(screen.getByRole("button", { name: "Collapse field Mobile" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText(/^Label/)).toHaveValue("Mobile");
    expect(screen.getByLabelText(/^Key/)).toHaveValue("mobile");
    expect(screen.getByLabelText("Type")).toHaveValue("text");
    expect(screen.getByLabelText("Smallest")).toBeVisible();
    expect(screen.getByLabelText("Largest")).toBeVisible();
    expect(screen.queryByLabelText(/^Choices/)).toBeNull();
    expect(screen.getByRole("switch", { name: "Required" })).toBeChecked();
  });

  it("shows the choices box for a dropdown, and no smallest and largest", () => {
    editor({ openId: "three" });
    expect(screen.getByLabelText(/^Choices/)).toHaveValue("Chennai\nMadurai");
    expect(screen.getByText("One choice on each line.")).toBeVisible();
    expect(screen.queryByLabelText("Smallest")).toBeNull();
  });

  it("leaves out the placeholder for a file field", () => {
    editor({ fields: [draft("f", "Plan", "file")], openId: "f" });
    expect(screen.queryByLabelText("Placeholder")).toBeNull();
  });

  it("tells the page what was typed, picked and switched in the open row", () => {
    const { onChange } = editor({ openId: "two" });
    fireEvent.change(screen.getByLabelText(/^Label/), { target: { value: "Phone" } });
    expect(onChange).toHaveBeenCalledWith("two", "label", "Phone");
    fireEvent.change(screen.getByLabelText(/^Key/), { target: { value: "phone" } });
    expect(onChange).toHaveBeenCalledWith("two", "key", "phone");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "number" } });
    expect(onChange).toHaveBeenCalledWith("two", "type", "number");
    fireEvent.click(screen.getByRole("switch", { name: "Required" }));
    expect(onChange).toHaveBeenCalledWith("two", "required", false);
  });

  it("removes a field, naming it", () => {
    const { onRemove } = editor({ openId: "two" });
    fireEvent.click(screen.getByRole("button", { name: "Remove field Mobile" }));
    expect(onRemove).toHaveBeenCalledWith("two");
  });

  it("moves a field with the arrow buttons, and has no arrow that goes nowhere", () => {
    const { onReorder } = editor();
    expect(screen.getByRole("button", { name: "Move field Name up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move field City down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move field Mobile up" }));
    expect(onReorder).toHaveBeenCalledWith(["two", "one", "three"]);
    fireEvent.click(screen.getByRole("button", { name: "Move field Name down" }));
    expect(onReorder).toHaveBeenLastCalledWith(["two", "one", "three"]);
  });

  it("adds a field and quick-adds a common one", () => {
    const { onAdd, onQuickAdd } = editor();
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "+ Mobile" }));
    expect(onQuickAdd).toHaveBeenCalledWith("mobile");
  });

  it("shows an error on its box, tied to it", () => {
    editor({
      openId: "two",
      errors: { two: { key: "This key is already used by another field." } },
    });
    expect(screen.getByLabelText(/^Key/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("This key is already used by another field.")).toBeVisible();
  });

  it("says so, and turns Add field and the quick adds off, at the limit", () => {
    editor({ max: 3 });
    expect(screen.getByText("This form has the most fields it can hold")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add field" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Name" })).toBeDisabled();
  });

  it("names a field with no label yet, and shows the empty note when there are none", () => {
    editor({ fields: [draft("blank", "", "text")] });
    expect(screen.getByRole("button", { name: "Edit field New field" })).toBeVisible();
  });

  it("shows the empty note when there are no fields", () => {
    editor({ fields: [] });
    expect(screen.getByText("No fields yet.")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("is off while saving", () => {
    editor({ openId: "two", disabled: true });
    expect(screen.getByLabelText(/^Label/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add field" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Required" })).toBeDisabled();
  });
});

describe("FormPreview: the read-only picture of a form (S7-T08)", () => {
  const fields = [
    { label: "Name", key: "name", type: "text" as const, required: true, placeholder: "Your name" },
    { label: "Message", key: "message", type: "textarea" as const, required: false },
  ];

  it("draws the fields and the button in a labelled region, none of it usable", () => {
    renderWithMessages(
      <FormPreview
        label="Live preview (read only)"
        fields={fields}
        buttonText="Send message"
        empty="Add a field."
        note="Submissions are checked on the server."
      />,
    );
    const region = screen.getByRole("complementary", { name: "Live preview (read only)" });
    const picture = region.querySelector("[inert]");
    expect(picture).not.toBeNull();
    expect(picture).toHaveAttribute("aria-hidden", "true");
    expect(picture?.textContent).toContain("Name");
    expect(picture?.textContent).toContain("Message");
    expect(picture?.textContent).toContain("Send message");
    expect(within(region).getByText("Submissions are checked on the server.")).toBeVisible();
  });

  it("says there is nothing to show while the form has no fields", () => {
    renderWithMessages(
      <FormPreview label="Live preview (read only)" fields={[]} empty="Add a field." />,
    );
    expect(screen.getByText("Add a field.")).toBeVisible();
    expect(document.querySelector("[inert]")).toBeNull();
  });
});
