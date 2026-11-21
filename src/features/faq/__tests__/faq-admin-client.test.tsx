// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryView } from "@/features/content-categories";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { FaqAdminBoard, type FaqBoardActions } from "../faq-admin-board.client";
import { FaqCategoriesPanel, type FaqCategoriesActions } from "../faq-categories-panel.client";
import { FaqEditor, type FaqEditorActions } from "../faq-editor.client";
import type { FaqAdminView } from "../view";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
const notice = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/notify", () => ({ notify: notice }));

const words = en.admin.faq;
const FAILED = {
  ok: false as const,
  code: "INTERNAL" as const,
};

const CATEGORIES: CategoryView[] = [
  { id: "c1", module: "faq", slug: "buyers", name: "Buyers", sortOrder: 1, active: true },
  { id: "c2", module: "faq", slug: "sellers", name: "Sellers", sortOrder: 2, active: false },
];

const faq = (id: string, extra: Partial<FaqAdminView> = {}): FaqAdminView => ({
  id,
  categoryId: "c1",
  question: `Question ${id}?`,
  answer: `Answer ${id}.`,
  sortOrder: 1,
  status: "published",
  deletedAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-20T10:00:00Z",
  ...extra,
});

const done = (id = "a") => ({
  ok: true as const,
  data: { faqId: id, categoryId: "c1", status: "draft" as const },
});

function boardActions(): FaqBoardActions {
  return {
    publish: vi.fn(async () => done()),
    unpublish: vi.fn(async () => done()),
    trash: vi.fn(async () => done()),
    restore: vi.fn(async () => done()),
    reorder: vi.fn(async () => ({ ok: true as const, data: { categoryId: "c1", count: 2 } })),
  };
}

function categoryActions(): FaqCategoriesActions {
  const ok = async () => ({
    ok: true as const,
    data: { categoryId: "c1", module: "faq", slug: "buyers" },
  });
  return { create: vi.fn(ok), update: vi.fn(ok), setActive: vi.fn(ok), remove: vi.fn(ok) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

function board(
  extra: Partial<Parameters<typeof FaqAdminBoard>[0]> = {},
  actions = boardActions(),
  categoriesActions = categoryActions(),
) {
  renderWithMessages(
    <FaqAdminBoard
      faqs={[faq("a"), faq("b", { status: "draft", sortOrder: 2 })]}
      trashed={[faq("t", { deletedAt: "2026-11-10T10:00:00Z", status: "draft" })]}
      categories={CATEGORIES}
      params={{ view: "all", category: "", query: "" }}
      actions={actions}
      categoryActions={categoriesActions}
      {...extra}
    />,
  );
  return { actions, categoriesActions };
}

describe("FaqAdminBoard (ADR-143): the admin's list", () => {
  it("lists the questions outside the Trash with their status in words, and counts on the tabs", () => {
    board();
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    expect(within(table).getAllByText("Question a?").length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.status.published).length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.status.draft).length).toBeGreaterThan(0);
    expect(screen.queryByText("Question t?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${words.tabs.trash} 1` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${words.tabs.drafts} 1` })).toBeInTheDocument();
  });

  it("shows only the Trash on the Trash tab, with Restore and no Edit", () => {
    board({ params: { view: "trash", category: "", query: "" } });
    expect(screen.getAllByText("Question t?").length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.status.trash).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Restore/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
  });

  it("puts a tab in the address, keeping the other choices", () => {
    board({ params: { view: "all", category: "c1", query: "" } });
    fireEvent.click(screen.getByRole("button", { name: `${words.tabs.published} 1` }));
    expect(navigation.replace).toHaveBeenCalledWith("/admin/faq?view=published&category=c1");
  });

  it("puts the search in the address a moment after the last key, not at every key", () => {
    vi.useFakeTimers();
    try {
      board();
      fireEvent.change(screen.getByRole("searchbox", { name: words.search.label }), {
        target: { value: "deed" },
      });
      expect(navigation.replace).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(navigation.replace).toHaveBeenCalledWith("/admin/faq?q=deed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("publishes a draft, then tells the admin and reads the page again", async () => {
    const { actions } = board();
    fireEvent.click(screen.getAllByRole("button", { name: /^Publish question/ })[0] as HTMLElement);
    await waitFor(() => expect(actions.publish).toHaveBeenCalledWith({ faqId: "b" }));
    await waitFor(() => expect(notice.success).toHaveBeenCalledWith(words.toast.published));
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("unpublishes, moves to the Trash and restores, each with its own call and message", async () => {
    const { actions } = board();
    fireEvent.click(screen.getAllByRole("button", { name: /^Unpublish/ })[0] as HTMLElement);
    await waitFor(() => expect(actions.unpublish).toHaveBeenCalledWith({ faqId: "a" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move to Trash: Question a?" })[0] as HTMLElement,
    );
    await waitFor(() => expect(actions.trash).toHaveBeenCalledWith({ faqId: "a" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.trashed);
  });

  it("restores from the Trash tab", async () => {
    const { actions } = board({ params: { view: "trash", category: "", query: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Restore/ })[0] as HTMLElement);
    await waitFor(() => expect(actions.restore).toHaveBeenCalledWith({ faqId: "t" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.restored);
  });

  it("says a question that is already gone is gone, and reads the page again", async () => {
    const actions = boardActions();
    actions.trash = vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const }));
    board({}, actions);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move to Trash: Question a?" })[0] as HTMLElement,
    );
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(words.conflict));
    expect(navigation.refresh).toHaveBeenCalled();
    expect(notice.success).not.toHaveBeenCalled();
  });

  it("says another failure in the words of its code, and does not say it worked", async () => {
    const actions = boardActions();
    actions.publish = vi.fn(async () => FAILED);
    board({}, actions);
    fireEvent.click(screen.getAllByRole("button", { name: /^Publish question/ })[0] as HTMLElement);
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(en.errors.INTERNAL));
    expect(notice.success).not.toHaveBeenCalled();
  });

  it("shows the order buttons only for one whole category, and sends the new order of its questions", async () => {
    const { actions } = board({ params: { view: "all", category: "c1", query: "" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move down: Question a?" })[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(actions.reorder).toHaveBeenCalledWith({ categoryId: "c1", faqIds: ["b", "a"] }),
    );
    expect(notice.success).toHaveBeenCalledWith(words.toast.moved);
  });

  it("leaves the order buttons off when no category is chosen, and says how to get them", () => {
    board();
    expect(screen.queryByRole("button", { name: /Move up/ })).not.toBeInTheDocument();
    expect(screen.getByText(words.orderNote)).toBeInTheDocument();
  });

  it("opens the categories drawer from its button", () => {
    board();
    fireEvent.click(screen.getByRole("button", { name: words.categoriesButton }));
    expect(screen.getByRole("dialog", { name: words.categories.title })).toBeInTheDocument();
  });

  it("marks a hidden category in the filter", () => {
    board();
    fireEvent.click(screen.getByRole("combobox", { name: words.category.label }));
    expect(screen.getByRole("option", { name: "Sellers (hidden)" })).toBeInTheDocument();
  });
});

function panel(
  extra: Partial<Parameters<typeof FaqCategoriesPanel>[0]> = {},
  actions = categoryActions(),
) {
  renderWithMessages(
    <FaqCategoriesPanel
      open
      onOpenChange={vi.fn()}
      categories={CATEGORIES}
      usage={{ c1: 3, c2: 0 }}
      actions={actions}
      {...extra}
    />,
  );
  return actions;
}

const texts = words.categories;

describe("FaqCategoriesPanel (ADR-143): the categories drawer", () => {
  it("lists the categories with their use, Hidden in words, and Delete off for one that holds questions", () => {
    panel();
    const list = screen.getByRole("list", { name: texts.listLabel });
    expect(within(list).getByText("3 questions")).toBeInTheDocument();
    expect(within(list).getByText("No questions")).toBeInTheDocument();
    expect(within(list).getByText(texts.hidden)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Buyers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Sellers" })).toBeEnabled();
    expect(screen.getByText(texts.inUse)).toBeInTheDocument();
  });

  it("suggests the address word from the name until the admin types their own, then adds the category last in the FAQ list", async () => {
    const actions = panel();
    fireEvent.change(screen.getByLabelText(texts.form.name), {
      target: { value: "Property owners" },
    });
    expect(screen.getByLabelText(texts.form.slug)).toHaveValue("property-owners");
    fireEvent.change(screen.getByLabelText(texts.form.slug), { target: { value: "owners" } });
    fireEvent.change(screen.getByLabelText(texts.form.name), {
      target: { value: "Owners of property" },
    });
    expect(screen.getByLabelText(texts.form.slug)).toHaveValue("owners");
    fireEvent.click(screen.getByRole("button", { name: texts.form.add }));
    await waitFor(() =>
      expect(actions.create).toHaveBeenCalledWith({
        module: "faq",
        name: "Owners of property",
        slug: "owners",
        sortOrder: 3,
        active: true,
      }),
    );
    expect(notice.success).toHaveBeenCalledWith(texts.toast.created);
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("puts a refused slug on its box and keeps what was typed", async () => {
    const actions = categoryActions();
    actions.create = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: { slug: [{ key: "validation.categorySlugTaken" }] },
    }));
    panel({}, actions);
    fireEvent.change(screen.getByLabelText(texts.form.name), { target: { value: "Buyers" } });
    fireEvent.click(screen.getByRole("button", { name: texts.form.add }));
    await waitFor(() =>
      expect(screen.getByLabelText(texts.form.slug)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByLabelText(texts.form.name)).toHaveValue("Buyers");
    expect(notice.success).not.toHaveBeenCalled();
  });

  it("edits a category in place: the form fills in, and saving keeps its place in the order", async () => {
    const actions = panel();
    fireEvent.click(screen.getByRole("button", { name: "Edit Sellers" }));
    expect(screen.getByLabelText(texts.form.name)).toHaveValue("Sellers");
    fireEvent.change(screen.getByLabelText(texts.form.name), {
      target: { value: "Sellers and agents" },
    });
    fireEvent.click(screen.getByRole("button", { name: texts.form.save }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({
        categoryId: "c2",
        name: "Sellers and agents",
        slug: "sellers",
        sortOrder: 2,
        active: false,
      }),
    );
    expect(notice.success).toHaveBeenCalledWith(texts.toast.saved);
  });

  it("hides and shows a category with its own action", async () => {
    const actions = panel();
    fireEvent.click(screen.getByRole("button", { name: "Hide Buyers" }));
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenCalledWith({ categoryId: "c1", active: false }),
    );
    expect(notice.success).toHaveBeenCalledWith(texts.toast.hidden);
    fireEvent.click(screen.getByRole("button", { name: "Show Sellers" }));
    await waitFor(() =>
      expect(actions.setActive).toHaveBeenLastCalledWith({ categoryId: "c2", active: true }),
    );
  });

  it("asks before deleting, and deletes only on the answer", async () => {
    const actions = panel();
    fireEvent.click(screen.getByRole("button", { name: "Delete Sellers" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: texts.delete.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ categoryId: "c2" }));
    expect(notice.success).toHaveBeenCalledWith(texts.toast.deleted);
  });

  it("puts a category in order by numbering the whole list and saving only the ones that changed", async () => {
    const actions = panel({
      categories: [
        { ...CATEGORIES[0], sortOrder: 0 } as CategoryView,
        { ...CATEGORIES[1], sortOrder: 0 } as CategoryView,
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Move Buyers down" }));
    await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(2));
    expect(actions.update).toHaveBeenNthCalledWith(1, {
      categoryId: "c2",
      name: "Sellers",
      slug: "sellers",
      sortOrder: 1,
      active: false,
    });
    expect(actions.update).toHaveBeenNthCalledWith(2, {
      categoryId: "c1",
      name: "Buyers",
      slug: "buyers",
      sortOrder: 2,
      active: true,
    });
    expect(notice.success).toHaveBeenCalledWith(texts.toast.moved);
  });

  it("leaves the first Move up and the last Move down off", () => {
    panel();
    expect(screen.getByRole("button", { name: "Move Buyers up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Sellers down" })).toBeDisabled();
  });
});

function editor(extra: Partial<Parameters<typeof FaqEditor>[0]> = {}) {
  const actions: FaqEditorActions = {
    create: vi.fn(async () => done()),
    update: vi.fn(async () => done()),
  };
  renderWithMessages(
    <FaqEditor
      faq={null}
      categories={[
        { value: "c1", label: "Buyers" },
        { value: "c2", label: "Sellers (hidden)" },
      ]}
      actions={actions}
      {...extra}
    />,
  );
  return actions;
}

describe("FaqEditor (ADR-143): the question page", () => {
  it("is titled for a new question, starts as a draft, and says so in the save bar", () => {
    editor();
    expect(screen.getByRole("heading", { level: 1, name: words.newTitle })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: words.form.statusDraft })).toBeChecked();
    expect(screen.getByText(words.saveNote.new)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.back })).toHaveAttribute("href", "/admin/faq");
  });

  it("creates a question with the typed values, then goes back to the list", async () => {
    const actions = editor({ initialCategory: "c1" });
    fireEvent.change(screen.getByLabelText(words.form.question), {
      target: { value: "How do I list my property?" },
    });
    fireEvent.change(screen.getByLabelText(words.form.answer), {
      target: { value: "Sign in first." },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(actions.create).toHaveBeenCalledWith({
        categoryId: "c1",
        question: "How do I list my property?",
        answer: "Sign in first.",
        status: "draft",
      }),
    );
    expect(notice.success).toHaveBeenCalledWith(words.toast.created);
    expect(navigation.push).toHaveBeenCalledWith("/admin/faq");
  });

  it("edits a stored question: the boxes are filled, and saving sends its id and goes back", async () => {
    const actions = editor({
      faq: faq("a", { question: "Stored question?", answer: "Stored answer." }),
    });
    expect(screen.getByRole("heading", { level: 1, name: words.editTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(words.form.question)).toHaveValue("Stored question?");
    fireEvent.click(screen.getByRole("radio", { name: words.form.statusDraft }));
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(actions.update).toHaveBeenCalledWith({
        faqId: "a",
        categoryId: "c1",
        question: "Stored question?",
        answer: "Stored answer.",
        status: "draft",
      }),
    );
    expect(notice.success).toHaveBeenCalledWith(words.toast.saved);
  });

  it("puts each refused value on its box, keeps what was typed and stays on the page", async () => {
    const actions = editor({ initialCategory: "c1" });
    actions.create = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: { question: [{ key: "validation.tooShort", values: { minimum: 5 } }] },
    }));
    fireEvent.change(screen.getByLabelText(words.form.question), { target: { value: "Why" } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(screen.getByLabelText(words.form.question)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByLabelText(words.form.question)).toHaveValue("Why");
    expect(screen.getByText("Use at least 5 characters.")).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("says a failure with no box in a toast, and says a question that is gone is gone", async () => {
    const actions = editor({ faq: faq("a") });
    actions.update = vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const }));
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(words.gone));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("goes back to the list on Cancel without saving", () => {
    const actions = editor({ faq: faq("a") });
    fireEvent.click(screen.getByRole("button", { name: words.form.cancel }));
    expect(navigation.push).toHaveBeenCalledWith("/admin/faq");
    expect(actions.update).not.toHaveBeenCalled();
  });
});
