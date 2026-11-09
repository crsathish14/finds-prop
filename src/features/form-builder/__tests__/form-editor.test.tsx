// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import { field } from "./fields";
import type { AdminFormView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { FormEditor } = await import("../form-editor.client");

const words = en.admin.forms.editor;

const PROJECTS = [{ id: "00000000-0000-4000-b000-0000000000a1", name: "Kadal Vista" }];
const INTEGRATIONS = [{ id: "00000000-0000-4000-b000-0000000000c1", name: "Sample CRM" }];

const stored: AdminFormView = {
  id: "00000000-0000-4000-b000-000000000001",
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  projectId: null,
  projectName: null,
  crmIntegrationId: INTEGRATIONS[0]?.id ?? null,
  crmName: "Sample CRM",
  buttonText: "Send message",
  successMessage: "Thank you.",
  active: true,
  fields: [
    field({ label: "Name", key: "name", type: "text", required: true, placeholder: "Your name" }),
    field({ label: "Mobile", key: "mobile", type: "text", required: true }),
  ],
  skippedFields: 0,
};

type Result =
  | { ok: true; data: { formId: string; slug: string } }
  | {
      ok: false;
      code: "VALIDATION";
      fieldErrors: Record<string, { key: string; values?: Record<string, string | number> }[]>;
    }
  | { ok: false; code: "INTERNAL" };

function open(form: AdminFormView | null, answer: Result = okAnswer("new-id")) {
  const save = vi
    .fn<(input: Record<string, unknown>) => Promise<Result>>()
    .mockResolvedValue(answer);
  renderWithMessages(
    <FormEditor form={form} projects={PROJECTS} integrations={INTEGRATIONS} save={save as never} />,
  );
  return { save };
}

function okAnswer(formId: string): Result {
  return { ok: true, data: { formId, slug: "x" } };
}

const box = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the form editor: a form that exists (S7-T08)", () => {
  it("opens with the stored form: the heading, the crumb, the Settings, the fields in order and the preview", () => {
    open(stored);
    expect(screen.getByRole("heading", { level: 1, name: words.editTitle })).toBeVisible();
    expect(screen.getByRole("link", { name: words.crumb.forms })).toHaveAttribute(
      "href",
      "/admin/forms",
    );
    expect(box("Name")).toHaveValue("Contact");
    expect(box("Slug")).toHaveValue("contact");
    expect(screen.getByRole("button", { name: "Edit field Name" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit field Mobile" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: words.preview.label })).toBeVisible();
  });

  it("saves the changes with the form's id, tells the admin, and reads the page again", async () => {
    const { save } = open(stored, okAnswer(stored.id));
    fireEvent.change(box("Button text"), { target: { value: "Send" } });
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      formId: stored.id,
      name: "Contact",
      slug: "contact",
      buttonText: "Send",
      placement: "contact",
      projectId: "",
    });
    expect((sent["fields"] as unknown[]).length).toBe(2);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.saved));
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps a saved field's key when its label is changed", () => {
    open(stored);
    fireEvent.click(screen.getByRole("button", { name: "Edit field Mobile" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Label/ }), {
      target: { value: "Mobile number" },
    });
    expect(screen.getByRole("textbox", { name: /^Key/ })).toHaveValue("mobile");
  });

  it("does not send a key used twice: it says which key, on that field, and opens it", async () => {
    const { save } = open(stored);
    fireEvent.click(screen.getByRole("button", { name: "Edit field Mobile" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Key/ }), { target: { value: "name" } });
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    expect(await screen.findByText('Key "name" is already used by another field.')).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("1 thing needs attention")).toBeVisible();
  });

  it("puts the server's problems on their boxes: a slug already used, and a dropdown with no choices", async () => {
    const { save } = open(
      {
        ...stored,
        fields: [
          ...stored.fields,
          field({ label: "City", key: "city", type: "dropdown", options: ["Chennai"] }),
        ],
      },
      {
        ok: false,
        code: "VALIDATION",
        fieldErrors: {
          slug: [{ key: "validation.formSlugTaken" }],
          "fields.2.options": [{ key: "validation.optionsRequired" }],
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(await screen.findByText(en.validation.formSlugTaken)).toBeVisible();
    expect(screen.getByText(en.validation.optionsRequired)).toBeVisible();
    expect(screen.getByText("2 things need attention")).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("clears a box's problem when the admin changes that box", async () => {
    open(stored, {
      ok: false,
      code: "VALIDATION",
      fieldErrors: { slug: [{ key: "validation.formSlugTaken" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    expect(await screen.findByText(en.validation.formSlugTaken)).toBeVisible();
    fireEvent.change(box("Slug"), { target: { value: "contact-us" } });
    await waitFor(() => expect(screen.queryByText(en.validation.formSlugTaken)).toBeNull());
  });

  it("says so in a toast when the save fails with no box to blame, and reads the page again", async () => {
    open(stored, { ok: false, code: "INTERNAL" });
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows how many stored fields do not fit the builder", () => {
    open({ ...stored, skippedFields: 2 });
    expect(screen.getByText(/2 stored fields do not fit the builder/)).toBeVisible();
  });

  it("goes back to the list on Cancel", () => {
    open(stored);
    fireEvent.click(screen.getByRole("button", { name: words.save.cancel }));
    expect(router.push).toHaveBeenCalledWith("/admin/forms");
  });
});

describe("the form editor: a new form", () => {
  it("starts empty, with the empty note, and an Enquiry kind shown nowhere", () => {
    open(null);
    expect(screen.getByRole("heading", { level: 1, name: words.newTitle })).toBeVisible();
    expect(box("Name")).toHaveValue("");
    expect(screen.getByText(words.fields.empty)).toBeVisible();
    expect(screen.getByRole("combobox", { name: /^Placement/ })).toHaveValue("none");
    expect(screen.getByRole("combobox", { name: /^Project/ })).toBeDisabled();
  });

  it("makes the slug follow the name until the admin types a slug", () => {
    open(null);
    fireEvent.change(box("Name"), { target: { value: "Kadal Vista site visit" } });
    expect(box("Slug")).toHaveValue("kadal-vista-site-visit");
    fireEvent.change(box("Slug"), { target: { value: "vista" } });
    fireEvent.change(box("Name"), { target: { value: "Something else" } });
    expect(box("Slug")).toHaveValue("vista");
  });

  it("turns the Project box on, and needed, when the placement is one project", () => {
    open(null);
    fireEvent.change(screen.getByRole("combobox", { name: /^Placement/ }), {
      target: { value: "project_specific" },
    });
    const project = screen.getByRole("combobox", { name: /^Project/ });
    expect(project).toBeEnabled();
    expect(within(project).getByRole("option", { name: "Kadal Vista" })).toBeInTheDocument();
  });

  it("adds a quick add as a field with its key, and gives a repeated one a free key", () => {
    open(null);
    fireEvent.click(screen.getByRole("button", { name: "+ Mobile" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Mobile" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /^Edit field Mobile/ })[1] as HTMLElement,
    );
    expect(screen.getByRole("textbox", { name: /^Key/ })).toHaveValue("mobile_2");
  });

  it("makes a new field's key follow its label, and stops when the admin types a key", () => {
    open(null);
    fireEvent.click(screen.getByRole("button", { name: words.fields.add }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Label/ }), {
      target: { value: "Preferred time" },
    });
    expect(screen.getByRole("textbox", { name: /^Key/ })).toHaveValue("preferred_time");
    fireEvent.change(screen.getByRole("textbox", { name: /^Key/ }), { target: { value: "when" } });
    fireEvent.change(screen.getByRole("textbox", { name: /^Label/ }), {
      target: { value: "Another" },
    });
    expect(screen.getByRole("textbox", { name: /^Key/ })).toHaveValue("when");
  });

  it("draws the live preview from the fields as they are typed", () => {
    open(null);
    fireEvent.click(screen.getByRole("button", { name: "+ Email" }));
    fireEvent.change(box("Button text"), { target: { value: "Ask us" } });
    const preview = screen.getByRole("complementary", { name: words.preview.label });
    expect(within(preview).getByText("Email")).toBeInTheDocument();
    expect(within(preview).getByText("Ask us")).toBeInTheDocument();
  });

  it("makes the form, then opens it on its own page", async () => {
    const { save } = open(null, okAnswer("made-id"));
    fireEvent.change(box("Name"), { target: { value: "Callback" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Mobile" }));
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("formId");
    expect(sent).toMatchObject({ name: "Callback", slug: "callback", active: true });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/forms/made-id"));
    expect(toast.success).toHaveBeenCalledWith(words.saved);
  });

  it("shows the server's 'add at least one field' as a note about the form", async () => {
    open(null, {
      ok: false,
      code: "VALIDATION",
      fieldErrors: { fields: [{ key: "validation.fieldsRequired" }] },
    });
    fireEvent.change(box("Name"), { target: { value: "Callback" } });
    fireEvent.click(screen.getByRole("button", { name: words.save.save }));
    expect(await screen.findByText(en.validation.fieldsRequired)).toBeVisible();
  });
});
