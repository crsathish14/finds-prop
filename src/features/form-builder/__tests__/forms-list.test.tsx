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

const { AdminForms } = await import("../forms-list.client");

const words = en.admin.forms;

const form = (name: string, extra: Partial<AdminFormView> = {}): AdminFormView => ({
  id: `00000000-0000-4000-b000-${name.replace(/\D/g, "").padStart(12, "0")}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  kind: "enquiry",
  placement: "none",
  projectId: null,
  projectName: null,
  crmIntegrationId: null,
  crmName: null,
  buttonText: null,
  successMessage: null,
  active: true,
  fields: [field({ label: "Name", key: "name", type: "text", required: true })],
  skippedFields: 0,
  ...extra,
});

const CONTACT = form("Form 1", { kind: "contact", placement: "contact", crmName: "Sample CRM" });
const VISIT = form("Form 2", {
  kind: "site_visit",
  placement: "project_specific",
  projectName: "Kadal Vista",
});
const OFF = form("Form 3", { active: false });

type Props = Parameters<typeof AdminForms>[0];

function open(props: Partial<Props> = {}) {
  const actions = {
    setActive: vi.fn(async () => ({ ok: true as const, data: {} })),
    duplicate: vi.fn(async () => ({
      ok: true as const,
      data: { formId: "x", slug: "form-1-copy" },
    })),
    remove: vi.fn(async () => ({ ok: true as const, data: {} })),
    ...props.actions,
  };
  const forms = props.forms ?? [CONTACT, VISIT, OFF];
  renderWithMessages(<AdminForms forms={forms} actions={actions} />);
  return { actions };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the admin's Forms page (S7-T08)", () => {
  it("lists each form with its kind, slug, field count, placement and CRM in the page's own words", () => {
    open();
    const table = screen.getByRole("table", { name: words.caption });
    expect(within(table).getByText("Contact", { selector: "p" })).toBeVisible();
    expect(within(table).getByText("Site visit", { selector: "p" })).toBeVisible();
    expect(within(table).getByText("Contact page")).toBeVisible();
    expect(within(table).getByText("Kadal Vista only")).toBeVisible();
    expect(within(table).getByText("Sample CRM")).toBeVisible();
    expect(within(table).getAllByText(words.crmNone)).toHaveLength(2);
    expect(screen.getByText("3 forms")).toBeVisible();
    expect(screen.getByRole("link", { name: words.new })).toHaveAttribute(
      "href",
      "/admin/forms/new",
    );
    expect(screen.getAllByRole("link", { name: /^Edit/ })[0]).toHaveAttribute(
      "href",
      `/admin/forms/${CONTACT.id}`,
    );
  });

  it("says there are no forms, with New form", () => {
    open({ forms: [] });
    expect(screen.getByText(words.empty.title)).toBeVisible();
    expect(screen.getAllByRole("link", { name: words.new }).length).toBeGreaterThan(0);
  });

  it("switches a form off: the switch moves at once, the change is saved, a toast says so and the page is read again", async () => {
    const { actions } = open();
    const toggle = screen.getByRole("switch", { name: "Active: Form 1" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(screen.getByRole("switch", { name: "Active: Form 1" })).not.toBeChecked();
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenCalledWith({ formId: CONTACT.id, active: false }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Form 1 is now off"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("switches a form on", async () => {
    const { actions } = open();
    fireEvent.click(screen.getByRole("switch", { name: "Active: Form 3" }));
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenCalledWith({ formId: OFF.id, active: true }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Form 3 is now active"));
  });

  it("puts the switch back and says why when the save fails", async () => {
    open({
      actions: {
        setActive: vi.fn(async () => ({
          ok: false as const,
          code: "CONFLICT" as const,
        })),
      } as unknown as Props["actions"],
    });
    fireEvent.click(screen.getByRole("switch", { name: "Active: Form 1" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(screen.getByRole("switch", { name: "Active: Form 1" })).toBeChecked();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("copies a form and says the copy is switched off", async () => {
    const { actions } = open();
    const row = screen.getAllByText("Form 1", { selector: "p" })[0]?.closest("tr");
    if (!row) throw new Error("no row");
    fireEvent.click(within(row).getByRole("button", { name: /^Duplicate/ }));
    await waitFor(() => expect(actions.duplicate).toHaveBeenCalledWith({ formId: CONTACT.id }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toast.duplicated, {
        description: "The copy is called form-1-copy and is switched off.",
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks before deleting, names the form, and deletes only when confirmed", async () => {
    const { actions } = open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Form 3" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete "Form 3"?')).toBeVisible();
    expect(within(dialog).getByText(/fall back to the standard enquiry form/)).toBeVisible();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: words.deleteDialog.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ formId: OFF.id }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Form 3 deleted"));
  });

  it("does not delete when the admin cancels", async () => {
    const { actions } = open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Form 3" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: words.cancel }));
    expect(actions.remove).not.toHaveBeenCalled();
  });
});
