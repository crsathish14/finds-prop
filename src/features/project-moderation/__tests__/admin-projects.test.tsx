// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { AdminProjectRow } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { AdminProjects } = await import("../admin-projects.client");

const words = en.admin.projects;

const project = (name: string, extra: Partial<AdminProjectRow> = {}): AdminProjectRow => ({
  id: `00000000-0000-4000-b000-${name.replace(/\D/g, "").padStart(12, "0")}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  locality: "OMR Navalur",
  priceMin: 7800000,
  priceMax: 11200000,
  cover: null,
  moderation: "pending",
  published: false,
  featured: false,
  builderId: "00000000-0000-4000-b000-0000000000b1",
  builderName: "Kadal Homes",
  leads: 0,
  ...extra,
});

const WAITING = project("Project 1");
const REJECTED = project("Project 2", { moderation: "rejected" });
const HIDDEN = project("Project 3", { moderation: "approved" });
const LIVE = project("Project 4", {
  moderation: "approved",
  published: true,
  featured: true,
  leads: 2,
  builderId: "00000000-0000-4000-b000-0000000000b2",
  builderName: "Nila Habitats",
});

type Props = Parameters<typeof AdminProjects>[0];

function open(props: Partial<Props> = {}) {
  const actions = {
    moderate: vi.fn(async () => ({ ok: true as const, data: {} })),
    remove: vi.fn(async () => ({ ok: true as const, data: {} })),
    ...props.actions,
  };
  const rows = props.rows ?? [WAITING, REJECTED, HIDDEN, LIVE];
  const view = renderWithMessages(
    <AdminProjects {...props} rows={rows} actions={actions} mediaBaseUrl="https://media.test" />,
  );
  return { actions, view, rows };
}

const rowOf = (name: string) => {
  const cell = screen.getAllByText(name, { selector: "p" })[0];
  const found = cell?.closest("tr");
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};

async function openMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `More actions for ${name}` }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  return screen.findByRole("menu");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminProjects: the admin's Projects page (S7-T04)", () => {
  it("shows the heading, the status tabs with their numbers, and a row for each project with its builder", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("4");
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Approved/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Rejected/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Draft/ })).toHaveTextContent("0");
    expect(within(rowOf("Project 4")).getByText("Nila Habitats")).toBeVisible();
    expect(within(rowOf("Project 4")).getByText(words.badges.published)).toBeVisible();
    expect(within(rowOf("Project 4")).getByText(words.badges.featured)).toBeVisible();
    expect(within(rowOf("Project 3")).getByText(words.badges.unpublished)).toBeVisible();
    expect(screen.getByText("4 projects")).toBeVisible();
  });

  it("offers Approve and Reject on a pending project, Approve on a rejected one, and Publish or Unpublish on an approved one", () => {
    open();
    const pending = within(rowOf("Project 1"));
    expect(pending.getByRole("button", { name: /Approve/ })).toBeVisible();
    expect(pending.getByRole("button", { name: /Reject/ })).toBeVisible();
    const rejected = within(rowOf("Project 2"));
    expect(rejected.getByRole("button", { name: /Approve/ })).toBeVisible();
    expect(rejected.queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(within(rowOf("Project 3")).getByRole("button", { name: /Publish/ })).toBeVisible();
    expect(within(rowOf("Project 4")).getByRole("button", { name: /Unpublish/ })).toBeVisible();
    expect(within(rowOf("Project 4")).queryByRole("button", { name: /Approve/ })).toBeNull();
  });

  it("approves a project, says so, and reads the page again", async () => {
    const { actions } = open();
    fireEvent.click(within(rowOf("Project 1")).getByRole("button", { name: /Approve/ }));
    await waitFor(() =>
      expect(actions.moderate).toHaveBeenCalledWith({
        projectId: WAITING.id,
        decision: "approve",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Project 1 approved"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks before rejecting, and rejects only when confirmed", async () => {
    const { actions } = open();
    fireEvent.click(within(rowOf("Project 1")).getByRole("button", { name: /Reject/ }));
    const question = await screen.findByRole("alertdialog");
    expect(within(question).getByText("Reject Project 1?")).toBeVisible();
    expect(within(question).getByText(words.rejectDialog.text)).toBeVisible();
    fireEvent.click(within(question).getByRole("button", { name: words.cancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actions.moderate).not.toHaveBeenCalled();

    fireEvent.click(within(rowOf("Project 1")).getByRole("button", { name: /Reject/ }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: words.rejectDialog.confirm,
      }),
    );
    await waitFor(() =>
      expect(actions.moderate).toHaveBeenCalledWith({
        projectId: WAITING.id,
        decision: "reject",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Project 1 rejected"));
  });

  it("publishes and unpublishes", async () => {
    const { actions } = open();
    fireEvent.click(within(rowOf("Project 3")).getByRole("button", { name: /Publish/ }));
    await waitFor(() =>
      expect(actions.moderate).toHaveBeenCalledWith({ projectId: HIDDEN.id, decision: "publish" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Project 3 published"));
    fireEvent.click(within(rowOf("Project 4")).getByRole("button", { name: /Unpublish/ }));
    await waitFor(() =>
      expect(actions.moderate).toHaveBeenCalledWith({
        projectId: LIVE.id,
        decision: "unpublish",
      }),
    );
  });

  it("says the project changed and reads the page again when the decision is refused as a conflict", async () => {
    open({
      actions: {
        moderate: vi.fn(async () => ({
          ok: false as const,
          code: "CONFLICT" as const,
          message: "not in that state",
        })),
        remove: vi.fn(),
      },
    });
    fireEvent.click(within(rowOf("Project 1")).getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("has Edit, Feature and View live in the menu of a live project, and the menu names the project", async () => {
    const { actions } = open();
    const menu = await openMenu("Project 3");
    // An approved project that is not live: no View live.
    expect(within(menu).getByRole("menuitem", { name: words.menu.feature })).toBeVisible();
    expect(within(menu).queryByRole("menuitem", { name: words.menu.viewLive })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: words.menu.edit })).toHaveAttribute(
      "href",
      `/admin/projects/${HIDDEN.id}`,
    );
    fireEvent.click(within(menu).getByRole("menuitem", { name: words.menu.feature }));
    await waitFor(() =>
      expect(actions.moderate).toHaveBeenCalledWith({ projectId: HIDDEN.id, decision: "feature" }),
    );
  });

  it("offers Remove from featured and View live for a featured, live project, and no Feature for a pending one", async () => {
    open();
    const live = await openMenu("Project 4");
    expect(within(live).getByRole("menuitem", { name: words.menu.unfeature })).toBeVisible();
    expect(within(live).getByRole("menuitem", { name: words.menu.viewLive })).toHaveAttribute(
      "href",
      "/projects/project-4",
    );
    fireEvent.keyDown(live, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    const pending = await openMenu("Project 1");
    expect(within(pending).queryByRole("menuitem", { name: words.menu.feature })).toBeNull();
  });

  it("disables Delete for a project with leads and says how many", async () => {
    open();
    const menu = await openMenu("Project 4");
    expect(within(menu).getByRole("menuitem", { name: "Delete (has 2 leads)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("asks before deleting a project with no leads, and deletes only when confirmed", async () => {
    const { actions } = open();
    const menu = await openMenu("Project 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: words.menu.delete }));
    const question = await screen.findByRole("alertdialog");
    expect(within(question).getByText("Delete Project 1?")).toBeVisible();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(question).getByRole("button", { name: words.deleteDialog.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ projectId: WAITING.id }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Project 1 deleted"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says the project changed, and reads the page again, when the database refuses a delete because leads have arrived since", async () => {
    const remove = vi.fn(async () => ({
      ok: false as const,
      code: "CONFLICT" as const,
      message: "has leads",
    }));
    open({ actions: { moderate: vi.fn(), remove } });
    const menu = await openMenu("Project 1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: words.menu.delete }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: words.deleteDialog.confirm,
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
    // No alert yet: it names the leads, which the page learns when it is read again.
    expect(screen.queryByText(words.deleteBlocked.title)).toBeNull();
  });

  it("filters by status tab, by builder and by a search of the name, the place and the builder", () => {
    open();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pending/ }), { button: 0 });
    expect(screen.getByText("1 project")).toBeVisible();
    expect(screen.queryByText("Project 4", { selector: "p" })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /All/ }), { button: 0 });
    fireEvent.change(screen.getByLabelText(words.builderFilter.label), {
      target: { value: LIVE.builderId },
    });
    expect(screen.getByText("1 project")).toBeVisible();
    expect(rowOf("Project 4")).toBeVisible();
    fireEvent.change(screen.getByLabelText(words.builderFilter.label), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: words.search }), {
      target: { value: "nila" },
    });
    expect(screen.getByText("1 project")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: words.search }), {
      target: { value: "nothing like this" },
    });
    expect(screen.getByText(words.noMatch.title)).toBeVisible();
  });

  it("says the list was cut when it was", () => {
    open({ truncated: true });
    expect(screen.getByText(words.truncated)).toBeVisible();
  });

  it("shows the empty page when there are no projects", () => {
    open({ rows: [] });
    expect(screen.getByText(words.empty.title)).toBeVisible();
    expect(screen.getByText(words.empty.text)).toBeVisible();
  });
});
