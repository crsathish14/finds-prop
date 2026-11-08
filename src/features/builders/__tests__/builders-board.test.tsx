// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { BuildersBoardActions } from "../builders-board.client";
import type { BuilderRowView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { BuildersBoard } = await import("../builders-board.client");

const words = en.admin.builders;
const NOW = Date.parse("2026-11-08T10:00:00+05:30");
const ID_1 = "00000000-0000-4000-9000-000000000001";
const ID_2 = "00000000-0000-4000-9000-000000000002";
const ID_3 = "00000000-0000-4000-9000-000000000003";
const URL = "https://findsprop.example/builder/login";

const builder = (id: string, extra: Partial<BuilderRowView> = {}): BuilderRowView => ({
  id,
  name: `Company ${id.slice(-1)}`,
  email: `company${id.slice(-1)}@example.test`,
  kind: "builder",
  status: "active",
  contactPerson: "Meena Raj",
  phone: null,
  logoUrl: null,
  website: null,
  description: null,
  projects: 4,
  leads: 148,
  invitedAt: "2026-11-01T10:00:00+00:00",
  lastSignInAt: "2026-11-05T04:00:00+00:00",
  ...extra,
});

const ROWS = [
  builder(ID_1),
  builder(ID_2, { status: "invited", kind: "agent", lastSignInAt: null }),
  builder(ID_3, { status: "inactive" }),
];

function open(
  options: { builders?: BuilderRowView[]; actions?: Partial<BuildersBoardActions> } = {},
) {
  const actions: BuildersBoardActions = {
    invite: vi.fn(async () => ({
      ok: true as const,
      data: { builderId: ID_1, signInUrl: URL },
    })),
    resend: vi.fn(async () => ({
      ok: true as const,
      data: { builderId: ID_2, signInUrl: URL },
    })),
    setActive: vi.fn(async () => ({
      ok: true as const,
      data: { builderId: ID_1, active: false },
    })),
    update: vi.fn(async () => ({ ok: true as const, data: { builderId: ID_1 } })),
    ...options.actions,
  };
  renderWithMessages(
    <BuildersBoard builders={options.builders ?? ROWS} now={NOW} actions={actions} />,
  );
  return actions;
}

/** The row that holds a name: the buttons repeat it as hidden text, so find the cell with the visible name. */
const rowOf = (name: string) => {
  const cell = screen.getAllByText(name, { selector: "span" })[0];
  const found = cell?.closest("tr");
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BuildersBoard: the admin's Builders page (S7-T05)", () => {
  it("shows the heading, a row for each builder with its state and words, and the count", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    const table = screen.getByRole("table", { name: words.table.caption });
    expect(within(table).getByText("company1@example.test")).toBeVisible();
    expect(within(rowOf("Company 1")).getByText("Active")).toBeVisible();
    expect(within(rowOf("Company 2")).getByText("Invited")).toBeVisible();
    expect(within(rowOf("Company 2")).getByText(words.kindAgent)).toBeVisible();
    expect(within(rowOf("Company 2")).getByText(words.neverSignedIn)).toBeVisible();
    expect(within(rowOf("Company 3")).getByText("Inactive")).toBeVisible();
    expect(within(rowOf("Company 1")).getByText("3 days ago")).toBeVisible();
    expect(screen.getByText("3 builders")).toBeVisible();
    expect(screen.getByText(words.footnote)).toBeVisible();
  });

  it("says Today with the time for a sign-in earlier the same day", () => {
    open({ builders: [builder(ID_1, { lastSignInAt: "2026-11-08T04:10:00+00:00" })] });
    expect(within(rowOf("Company 1")).getByText(/^Today, /)).toBeVisible();
  });

  it("shows the empty page with a New builder button when there are none", () => {
    open({ builders: [] });
    expect(screen.getByRole("heading", { name: words.empty.title })).toBeVisible();
    expect(screen.getByText(words.empty.text)).toBeVisible();
    expect(screen.getAllByRole("button", { name: words.actions.new })).toHaveLength(2);
  });

  it("invites: sends what was typed, then shows the sign-in address and says so", async () => {
    const actions = open();
    fireEvent.click(screen.getAllByRole("button", { name: words.actions.new })[0] as HTMLElement);
    const drawer = await screen.findByRole("dialog", { name: words.invite.title });
    await userEvent.type(within(drawer).getByLabelText(new RegExp(words.form.name)), "Kadal Homes");
    await userEvent.type(
      within(drawer).getByLabelText(new RegExp(words.form.email)),
      "sales@kadalhomes.example",
    );
    fireEvent.click(within(drawer).getByRole("button", { name: words.invite.submit }));
    await waitFor(() => expect(actions.invite).toHaveBeenCalledTimes(1));
    expect(actions.invite).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Kadal Homes",
        email: "sales@kadalhomes.example",
        kind: "builder",
      }),
    );
    const after = await screen.findByRole("dialog", { name: words.address.invitedTitle });
    expect(within(after).getByDisplayValue(URL)).toBeVisible();
    expect(within(after).getByText(/sales@kadalhomes\.example/)).toBeVisible();
    expect(toast.success).toHaveBeenCalledWith(words.toast.invited.title, {
      description: "sales@kadalhomes.example can now sign in with Google.",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("puts a field's message on its box when the invitation is refused, and stays open", async () => {
    const actions = open({
      actions: {
        invite: vi.fn(async () => ({
          ok: false as const,
          code: "VALIDATION" as const,
          fieldErrors: { email: [{ key: "validation.builderEmailReserved" }] },
        })),
      },
    });
    fireEvent.click(screen.getAllByRole("button", { name: words.actions.new })[0] as HTMLElement);
    const drawer = await screen.findByRole("dialog", { name: words.invite.title });
    fireEvent.click(within(drawer).getByRole("button", { name: words.invite.submit }));
    await waitFor(() => expect(actions.invite).toHaveBeenCalled());
    expect(await within(drawer).findByText(en.validation.builderEmailReserved)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: words.address.invitedTitle })).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("edits: opens with what is on record, keeps the email locked, saves and says so", async () => {
    const actions = open();
    fireEvent.click(
      within(rowOf("Company 1")).getByRole("button", {
        name: new RegExp(`^${words.actions.edit}`),
      }),
    );
    const drawer = await screen.findByRole("dialog", { name: words.edit.title });
    const email = within(drawer).getByLabelText(new RegExp(words.form.email));
    expect(email).toHaveValue("company1@example.test");
    expect(email).toBeDisabled();
    expect(within(drawer).getByLabelText(new RegExp(words.form.contactPerson))).toHaveValue(
      "Meena Raj",
    );
    fireEvent.click(within(drawer).getByRole("button", { name: words.edit.submit }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(1));
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({ builderId: ID_1, name: "Company 1" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(words.toast.saved.title, {
      description: words.toast.saved.text,
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("offers Resend invitation only for an invited builder, and shows the address again", async () => {
    const actions = open();
    const menuOf = async (name: string) => {
      fireEvent.pointerDown(
        within(rowOf(name)).getByRole("button", {
          name: words.actions.more.replace("{name}", name),
        }),
        { button: 0, ctrlKey: false, pointerType: "mouse" },
      );
      return screen.findByRole("menu");
    };
    const first = await menuOf("Company 1");
    expect(within(first).queryByRole("menuitem", { name: words.actions.resend })).toBeNull();
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    const second = await menuOf("Company 2");
    fireEvent.click(within(second).getByRole("menuitem", { name: words.actions.resend }));
    await waitFor(() => expect(actions.resend).toHaveBeenCalledWith({ builderId: ID_2 }));
    const after = await screen.findByRole("dialog", { name: words.address.title });
    expect(within(after).getByDisplayValue(URL)).toBeVisible();
  });

  it("asks before deactivating, deactivates on confirming, and activates at once", async () => {
    const actions = open();
    const menuOf = async (name: string) => {
      fireEvent.pointerDown(
        within(rowOf(name)).getByRole("button", {
          name: words.actions.more.replace("{name}", name),
        }),
        { button: 0, ctrlKey: false, pointerType: "mouse" },
      );
      return screen.findByRole("menu");
    };
    const first = await menuOf("Company 1");
    fireEvent.click(within(first).getByRole("menuitem", { name: words.actions.deactivate }));
    const question = await screen.findByRole("alertdialog");
    expect(within(question).getByText("Deactivate Company 1?")).toBeVisible();
    expect(actions.setActive).not.toHaveBeenCalled();
    fireEvent.click(within(question).getByRole("button", { name: words.actions.deactivate }));
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenCalledWith({ builderId: ID_1, active: false }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(words.toast.deactivated.title, {
      description: "Company 1 can no longer sign in to the builder portal.",
    });

    const third = await menuOf("Company 3");
    fireEvent.click(within(third).getByRole("menuitem", { name: words.actions.activate }));
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenLastCalledWith({ builderId: ID_3, active: true }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("says a conflict in words and reads the page again", async () => {
    const actions = open({
      actions: {
        resend: vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const })),
      },
    });
    fireEvent.pointerDown(
      within(rowOf("Company 2")).getByRole("button", {
        name: words.actions.more.replace("{name}", "Company 2"),
      }),
      { button: 0, ctrlKey: false, pointerType: "mouse" },
    );
    fireEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: words.actions.resend,
      }),
    );
    await waitFor(() => expect(actions.resend).toHaveBeenCalled());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
  });
});
