// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { UnitsBoardActions } from "../units-board.client";
import type { UnitView, UnitsPage } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { UnitsBoard } = await import("../units-board.client");

const words = en.admin.units;
const PROJECT = "00000000-0000-4000-b000-000000000001";
const OTHER = "00000000-0000-4000-b000-000000000002";
const PROJECTS = [
  { id: PROJECT, name: "Kadal Vista" },
  { id: OTHER, name: "Kadal Courts" },
];

const unit = (number: string, extra: Partial<UnitView> = {}): UnitView => ({
  id: `00000000-0000-4000-a000-${number.replace(/\D/g, "").padStart(12, "0")}`,
  unitNumber: number,
  floor: 1,
  bhk: 2,
  areaSqft: 1050,
  facing: "East",
  price: 7800000,
  availableFrom: "2026-12-01",
  floorPlanUrl: null,
  status: "available",
  ...extra,
});

const A101 = unit("A-101");
const A102 = unit("A-102", {
  floor: null,
  bhk: null,
  areaSqft: null,
  facing: null,
  price: null,
  status: "hold",
});

const DONE = { unitId: A101.id, projectId: PROJECT, projectSlug: "kadal-vista" };

function open(
  options: {
    page?: Partial<UnitsPage>;
    filters?: Partial<Parameters<typeof UnitsBoard>[0]["filters"]>;
    actions?: Partial<UnitsBoardActions>;
    path?: string;
    intro?: string;
  } = {},
) {
  const actions: UnitsBoardActions = {
    add: vi.fn(async () => ({ ok: true as const, data: DONE })),
    update: vi.fn(async () => ({ ok: true as const, data: DONE })),
    remove: vi.fn(async () => ({ ok: true as const, data: DONE })),
    loadMore: vi.fn(async () => ({
      ok: true as const,
      data: { units: [unit("A-103")], total: 3, nextCursor: null },
    })),
    ...options.actions,
  };
  const page: UnitsPage = { units: [A101, A102], total: 2, nextCursor: null, ...options.page };
  renderWithMessages(
    <UnitsBoard
      projects={PROJECTS}
      filters={{ projectId: PROJECT, state: "all", ...options.filters }}
      page={page}
      actions={actions}
      {...(options.path ? { path: options.path } : {})}
      {...(options.intro ? { intro: options.intro } : {})}
    />,
  );
  return actions;
}

/** The row that holds a unit number (the buttons repeat it as hidden text, so find the bold cell). */
const rowOf = (number: string) => {
  const cell = screen.getAllByText(number, { selector: "b" })[0];
  const found = cell?.closest("tr");
  if (!found) throw new Error(`no row for ${number}`);
  return found;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UnitsBoard: the admin's Units page (S7-T07)", () => {
  it("shows the heading, a row for each unit with its values formatted, and the count and the note", () => {
    open({ page: { total: 320 } });
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    const table = screen.getByRole("table", { name: words.table.caption });
    expect(within(table).getByText("₹78 L")).toBeVisible();
    expect(within(rowOf("A-101")).getByText("2 BHK")).toBeVisible();
    expect(within(rowOf("A-101")).getByText("1,050 sq.ft")).toBeVisible();
    expect(within(rowOf("A-101")).getByText("Available")).toBeVisible();
    expect(within(rowOf("A-102")).getByText("On hold")).toBeVisible();
    expect(within(rowOf("A-102")).getAllByText(words.dash).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("2 of 320 units")).toBeVisible();
    expect(screen.getByText(words.note)).toBeVisible();
  });

  it("offers every project and the chosen one is on, and goes to another project's page when one is picked", () => {
    open();
    const box = screen.getByLabelText(words.project);
    expect(box).toHaveValue(PROJECT);
    fireEvent.change(box, { target: { value: OTHER } });
    expect(router.push).toHaveBeenCalledWith(`/admin/units?project=${OTHER}`);
  });

  it("keeps its links under the path it is given, and says the line it is given (the builder's page, S7-T03)", () => {
    open({ path: "/builder/units", intro: "Manage the units of your projects." });
    expect(screen.getByText("Manage the units of your projects.")).toBeVisible();
    expect(screen.queryByText(words.intro)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(words.project), { target: { value: OTHER } });
    expect(router.push).toHaveBeenCalledWith(`/builder/units?project=${OTHER}`);
  });

  it("goes to the page for a state chip, keeping the project and the search", () => {
    open({ filters: { search: "A-1" } });
    fireEvent.click(screen.getByRole("button", { name: words.states.sold }));
    expect(router.push).toHaveBeenCalledWith(
      `/admin/units?project=${PROJECT}&state=sold&search=A-1`,
    );
  });

  it("applies the search a moment after the last key, not at each letter", () => {
    vi.useFakeTimers();
    open();
    const box = screen.getByRole("searchbox", { name: words.search.label });
    fireEvent.change(box, { target: { value: "A-" } });
    fireEvent.change(box, { target: { value: "A-1" } });
    expect(router.replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(`/admin/units?project=${PROJECT}&search=A-1`);
  });

  it("adds a unit: sends what was typed with the project, says so and reads the page again", async () => {
    const actions = open();
    fireEvent.click(screen.getAllByRole("button", { name: words.actions.add })[0] as HTMLElement);
    const drawer = await screen.findByRole("dialog", { name: words.add.title });
    await userEvent.type(within(drawer).getByLabelText(new RegExp(words.form.unitNumber)), "B-303");
    await userEvent.type(within(drawer).getByLabelText(/^Price/), "11800000");
    fireEvent.click(within(drawer).getByRole("button", { name: words.add.submit }));
    await waitFor(() => expect(actions.add).toHaveBeenCalledTimes(1));
    expect(actions.add).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT,
        unitNumber: "B-303",
        price: "11800000",
        status: "available",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(words.toast.added.title, {
      description: "B-303 is now in the project.",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("puts a message on the number's box when the unit number is taken, and stays open", async () => {
    const actions = open({
      actions: {
        add: vi.fn(async () => ({
          ok: false as const,
          code: "VALIDATION" as const,
          fieldErrors: { unitNumber: [{ key: "validation.unitNumberTaken" }] },
        })),
      },
    });
    fireEvent.click(screen.getAllByRole("button", { name: words.actions.add })[0] as HTMLElement);
    const drawer = await screen.findByRole("dialog", { name: words.add.title });
    fireEvent.click(within(drawer).getByRole("button", { name: words.add.submit }));
    await waitFor(() => expect(actions.add).toHaveBeenCalled());
    expect(await within(drawer).findByText(en.validation.unitNumberTaken)).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("edits: opens with what is on record, saves the unit by its id and says so", async () => {
    const actions = open();
    fireEvent.click(
      within(rowOf("A-101")).getByRole("button", {
        name: `${words.actions.edit} ${words.actions.editFor.replace("{number}", "A-101")}`,
      }),
    );
    const drawer = await screen.findByRole("dialog", { name: words.edit.title });
    expect(within(drawer).getByLabelText(new RegExp(words.form.unitNumber))).toHaveValue("A-101");
    expect(within(drawer).getByLabelText(new RegExp(words.form.facing))).toHaveValue("east");
    expect(within(drawer).getByLabelText(/^Price/)).toHaveValue("7800000");
    expect(within(drawer).getByLabelText(new RegExp(words.form.availableFrom))).toHaveValue(
      "2026-12-01",
    );
    fireEvent.click(within(drawer).getByRole("button", { name: words.edit.submit }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(1));
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: A101.id, unitNumber: "A-101", facing: "east" }),
    );
    expect(toast.success).toHaveBeenCalledWith(words.toast.saved.title, {
      description: "The details of A-101 have been updated.",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks before deleting, deletes on confirming and reads the page again", async () => {
    const actions = open();
    fireEvent.click(
      within(rowOf("A-102")).getByRole("button", {
        name: words.actions.delete.replace("{number}", "A-102"),
      }),
    );
    const question = await screen.findByRole("alertdialog");
    expect(within(question).getByText("Delete unit A-102?")).toBeVisible();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(within(question).getByRole("button", { name: words.delete.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ unitId: A102.id }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(words.toast.deleted.title, {
      description: "A-102 has been removed from the project.",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says a unit that is gone or changed in words and reads the page again", async () => {
    open({
      actions: {
        remove: vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const })),
      },
    });
    fireEvent.click(
      within(rowOf("A-101")).getByRole("button", {
        name: words.actions.delete.replace("{number}", "A-101"),
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: words.delete.confirm,
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows Show more only when there are more units, adds the next ones in place, and then stops", async () => {
    const actions = open({ page: { total: 3, nextCursor: "A-102" } });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.button }));
    await waitFor(() =>
      expect(actions.loadMore).toHaveBeenCalledWith({
        projectId: PROJECT,
        state: "all",
        after: "A-102",
      }),
    );
    expect((await screen.findAllByText("A-103", { selector: "b" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: words.showMore.button })).toBeNull();
    expect(screen.getByText("3 of 3 units")).toBeVisible();
  });

  it("says in words when more units could not be loaded, and keeps the button", async () => {
    open({
      page: { total: 3, nextCursor: "A-102" },
      actions: { loadMore: vi.fn(async () => ({ ok: false as const, code: "INTERNAL" as const })) },
    });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.button }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.showMore.failed));
    expect(screen.getByRole("button", { name: words.showMore.button })).toBeVisible();
  });

  it("shows the empty page with Add unit when the project has none", () => {
    open({ page: { units: [], total: 0 } });
    expect(screen.getByRole("heading", { name: words.empty.title })).toBeVisible();
    expect(screen.getAllByRole("button", { name: words.actions.add })).toHaveLength(2);
  });
});
