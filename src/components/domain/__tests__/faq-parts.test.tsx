// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CategoryManager, type CategoryFormProps, type CategoryRow } from "../category-manager";
import { FaqAccordion, type FaqAccordionGroup } from "../faq-accordion.client";
import { FaqFilterBar, type FaqFilterBarProps } from "../faq-filter-bar";
import { FaqFormFields, type FaqFormValues, type FaqFormWords } from "../faq-form-fields";
import { FaqManager, type FaqManagerProps, type FaqRow } from "../faq-manager";

const GROUPS: FaqAccordionGroup[] = [
  {
    slug: "buyers",
    name: "Buyers",
    countLabel: "2 questions",
    items: [
      { id: "q1", question: "How do I contact an owner?", paragraphs: ["Choose Contact owner."] },
      {
        id: "q2",
        question: "Which papers do I need?",
        paragraphs: ["The sale deed.", "An identity proof."],
      },
    ],
  },
  {
    slug: "sellers",
    name: "Sellers",
    countLabel: "1 question",
    items: [{ id: "q3", question: "Is posting free?", paragraphs: ["Yes."] }],
  },
];

const itemOf = (question: string) =>
  screen.getByText(question).closest("details") as HTMLDetailsElement;

describe("FaqAccordion (ADR-143): the public questions", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("names each category with a level-2 heading and its count, and each question with a level-3 heading", () => {
    renderWithMessages(<FaqAccordion groups={GROUPS} />);
    expect(screen.getByRole("heading", { level: 2, name: "Buyers" })).toBeInTheDocument();
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Sellers" })).toBeInTheDocument();
  });

  it("starts closed, opens a question on click and lets another stay open", () => {
    renderWithMessages(<FaqAccordion groups={GROUPS} />);
    expect(itemOf("How do I contact an owner?").open).toBe(false);
    fireEvent.click(screen.getByText("How do I contact an owner?"));
    fireEvent.click(screen.getByText("Which papers do I need?"));
    expect(itemOf("How do I contact an owner?").open).toBe(true);
    expect(itemOf("Which papers do I need?").open).toBe(true);
  });

  it("keeps every answer in the page, closed or not, and draws each paragraph as text and never as markup", () => {
    renderWithMessages(
      <FaqAccordion
        groups={[
          {
            slug: "x",
            name: "X",
            countLabel: "1 question",
            items: [{ id: "a", question: "Q?", paragraphs: ["<b>one</b>", "two"] }],
          },
        ]}
      />,
    );
    expect(screen.getByText("<b>one</b>").tagName).toBe("P");
    expect(screen.getByText("two").tagName).toBe("P");
    expect(document.querySelector("b")).toBeNull();
  });

  it("gives every question the anchor faq-<id>, and opens the ones it was told to", () => {
    renderWithMessages(<FaqAccordion groups={GROUPS} openIds={["q2"]} />);
    expect(document.getElementById("faq-q1")).not.toBeNull();
    expect(document.getElementById("faq-q3")).not.toBeNull();
    expect(itemOf("Which papers do I need?").open).toBe(true);
    expect(itemOf("How do I contact an owner?").open).toBe(false);
  });

  it("opens the question an address names, and scrolls to it", () => {
    const scrolled = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrolled;
    window.location.hash = "#faq-q3";
    renderWithMessages(<FaqAccordion groups={GROUPS} />);
    expect(itemOf("Is posting free?").open).toBe(true);
    expect(scrolled).toHaveBeenCalled();
  });

  it("ignores an address that names no question here, and opens one when the address changes", () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.location.hash = "#faq-nothing";
    renderWithMessages(<FaqAccordion groups={GROUPS} />);
    expect(document.querySelectorAll("details[open]")).toHaveLength(0);
    act(() => {
      window.location.hash = "#faq-q2";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(itemOf("Which papers do I need?").open).toBe(true);
  });
});
function barProps(extra: Partial<FaqFilterBarProps> = {}): FaqFilterBarProps {
  return {
    search: {
      label: "Search the questions",
      placeholder: "Search",
      submitLabel: "Search",
      value: "",
      name: "q",
      action: "/faq",
    },
    categories: {
      label: "Categories",
      all: { label: "All", href: "/faq", selected: true },
      options: [
        { slug: "buyers", label: "Buyers", href: "/faq?category=buyers", selected: false },
        { slug: "sellers", label: "Sellers", href: "/faq?category=sellers", selected: false },
      ],
    },
    summary: "3 questions",
    ...extra,
  };
}

describe("FaqFilterBar (ADR-143): search and categories in the address", () => {
  it("is a plain search form that sends the words by GET, with the box named and filled", () => {
    renderWithMessages(
      <FaqFilterBar
        {...barProps({
          search: {
            ...barProps().search,
            value: "sale deed",
            hidden: [{ name: "category", value: "buyers" }],
          },
        })}
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/faq");
    expect(form).toHaveAttribute("method", "get");
    const box = within(form).getByRole("searchbox", { name: "Search the questions" });
    expect(box).toHaveAttribute("name", "q");
    expect(box).toHaveValue("sale deed");
    expect(form.querySelector('input[type="hidden"][name="category"]')).toHaveAttribute(
      "value",
      "buyers",
    );
    expect(within(form).getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("draws the chips as links, with the chosen one marked current", () => {
    renderWithMessages(<FaqFilterBar {...barProps()} />);
    const nav = screen.getByRole("navigation", { name: "Categories" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/faq",
      "/faq?category=buyers",
      "/faq?category=sellers",
    ]);
    expect(within(nav).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Buyers" })).not.toHaveAttribute("aria-current");
  });

  it("says what was found in a polite status line, and shows Clear only while something is chosen", () => {
    const { rerender } = renderWithMessages(<FaqFilterBar {...barProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 questions");
    expect(screen.queryByRole("link", { name: "Clear" })).not.toBeInTheDocument();
    rerender(
      <FaqFilterBar
        {...barProps({ summary: "No questions", clear: { label: "Clear", href: "/faq" } })}
      />,
    );
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/faq");
  });
});

function faqRow(id: string, extra: Partial<FaqRow> = {}): FaqRow {
  return {
    id,
    question: `Question ${id}`,
    categoryName: "Buyers",
    status: "published",
    statusLabel: "Published",
    updated: "20 Nov 2026",
    editHref: `/admin/faq/${id}`,
    editLabel: "Edit",
    editFor: `question ${id}`,
    toggle: { label: "Unpublish", forName: `question ${id}`, onClick: vi.fn() },
    trash: { label: `Move to Trash: question ${id}`, onClick: vi.fn() },
    ...extra,
  };
}

function manager(extra: Partial<FaqManagerProps> = {}): FaqManagerProps {
  return {
    title: "FAQ",
    intro: "Questions and answers.",
    addLabel: "Add question",
    addHref: "/admin/faq/new",
    categoriesLabel: "Categories",
    onCategories: vi.fn(),
    tabs: {
      label: "Show",
      options: [
        { value: "all", label: "All", count: 2 },
        { value: "trash", label: "Trash", count: 1 },
      ],
      value: "all",
      onChange: vi.fn(),
    },
    category: {
      label: "Category",
      allLabel: "All categories",
      options: [{ value: "buyers", label: "Buyers" }],
      value: "",
      onChange: vi.fn(),
    },
    search: { value: "", onChange: vi.fn(), label: "Search the questions", placeholder: "Search" },
    columns: {
      question: "Question",
      category: "Category",
      status: "Status",
      updated: "Updated",
      actions: "Actions",
    },
    caption: "FAQ questions",
    rows: [faqRow("a"), faqRow("b", { status: "draft", statusLabel: "Draft" })],
    countText: "2 of 2 questions",
    empty: { title: "No questions yet", text: "Add the first one." },
    noMatches: { title: "No questions match", text: "Try other words." },
    ...extra,
  };
}

describe("FaqManager (ADR-143): the admin's list", () => {
  it("shows the heading, Add question as a link, Categories as a button, and the count line", () => {
    const props = manager();
    renderWithMessages(<FaqManager {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add question" })).toHaveAttribute(
      "href",
      "/admin/faq/new",
    );
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(props.onCategories).toHaveBeenCalledOnce();
    expect(screen.getByText("2 of 2 questions")).toBeInTheDocument();
  });

  it("gives each row Edit (a link naming the question), the toggle and Move to Trash", () => {
    const props = manager();
    renderWithMessages(<FaqManager {...props} />);
    expect(screen.getAllByRole("link", { name: "Edit question a" })[0]).toHaveAttribute(
      "href",
      "/admin/faq/a",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Unpublish question a" })[0] as HTMLElement,
    );
    expect(props.rows[0]?.toggle.onClick).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Move to Trash: question a" })[0] as HTMLElement,
    );
    expect(props.rows[0]?.trash?.onClick).toHaveBeenCalledOnce();
  });

  it("says the status in words, and says In the Trash for a trashed question, with Restore and no Edit", () => {
    renderWithMessages(
      <FaqManager
        {...manager({
          rows: [
            faqRow("c", {
              status: "draft",
              statusLabel: "In the Trash",
              trashed: true,
              toggle: { label: "Restore", forName: "question c", onClick: vi.fn() },
              trash: undefined as never,
            }),
          ],
        })}
      />,
    );
    expect(screen.getAllByText("In the Trash").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Restore question c" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Edit question c/ })).not.toBeInTheDocument();
  });

  it("shows the order buttons only when the row has them, off at the ends", () => {
    renderWithMessages(
      <FaqManager
        {...manager({
          rows: [
            faqRow("a", {
              moveUp: { label: "Move up: question a", onClick: vi.fn(), disabled: true },
              moveDown: { label: "Move down: question a", onClick: vi.fn() },
            }),
            faqRow("b"),
          ],
        })}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Move up: question a" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Move down: question a" })[0]).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Move up: question b" })).not.toBeInTheDocument();
  });

  it("switches every row button off while the list is being changed", () => {
    renderWithMessages(<FaqManager {...manager({ pending: true })} />);
    for (const button of screen.getAllByRole("button", { name: /question a/ })) {
      expect(button).toBeDisabled();
    }
  });

  it("marks the chosen tab, reports a change of tab, and reports typing and the category", () => {
    const props = manager();
    renderWithMessages(<FaqManager {...props} />);
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Trash/ }));
    expect(props.tabs.onChange).toHaveBeenCalledWith("trash");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the questions" }), {
      target: { value: "deed" },
    });
    expect(props.search.onChange).toHaveBeenCalledWith("deed");
  });

  it("shows the empty state with Add question when there are none, and 'no match' when a filter finds none", () => {
    const { rerender } = renderWithMessages(<FaqManager {...manager({ rows: [] })} />);
    expect(screen.getByRole("heading", { name: "No questions yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add question" })).toHaveLength(2);
    rerender(
      <FaqManager {...manager({ rows: [], search: { ...manager().search, value: "zzzz" } })} />,
    );
    expect(screen.getByRole("heading", { name: "No questions match" })).toBeInTheDocument();
  });
});

const FORM_WORDS: FaqFormWords = {
  content: { title: "Question and answer", description: "What a visitor reads." },
  publishing: { title: "Publishing", description: "A draft is not shown." },
  category: "Category",
  categoryPlaceholder: "Choose a category",
  noCategory: "Add a category first.",
  question: "Question",
  questionHint: "One line.",
  answer: "Answer",
  answerHint: "Plain text.",
  answerCounter: (count, max) => `${count} / ${max}`,
  status: "Status",
  statusDraft: "Draft",
  statusPublished: "Published",
  statusHint: "Publishing shows it at once.",
};

describe("FaqFormFields (ADR-143): the question page", () => {
  const values: FaqFormValues = {
    categoryId: "buyers",
    question: "Which papers?",
    answer: "The deed.",
    status: "draft",
  };
  const categories = [{ value: "buyers", label: "Buyers" }];

  it("labels every box, counts the answer, and reports each change as the new values", () => {
    const onChange = vi.fn();
    renderWithMessages(
      <FaqFormFields
        values={values}
        onChange={onChange}
        categories={categories}
        limits={{ question: 300, answer: 5000 }}
        words={FORM_WORDS}
      />,
    );
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Which papers now?" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...values, question: "Which papers now?" });
    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "The deed and a receipt." },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...values, answer: "The deed and a receipt." });
    expect(screen.getByText("9 / 5000")).toBeInTheDocument();
    expect(screen.getByLabelText("Question")).toHaveAttribute("maxlength", "300");
  });

  it("shows the problems beside their boxes", () => {
    renderWithMessages(
      <FaqFormFields
        values={values}
        onChange={vi.fn()}
        categories={categories}
        limits={{ question: 300, answer: 5000 }}
        errors={{ question: "Use at least 5 characters.", answer: "This field is required." }}
        words={FORM_WORDS}
      />,
    );
    expect(screen.getByLabelText("Question")).toHaveAccessibleDescription(
      expect.stringContaining("Use at least 5 characters."),
    );
    expect(screen.getByLabelText("Answer")).toHaveAttribute("aria-invalid", "true");
  });

  it("changes the status with the choice, and turns every box off while saving", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithMessages(
      <FaqFormFields
        values={values}
        onChange={onChange}
        categories={categories}
        limits={{ question: 300, answer: 5000 }}
        words={FORM_WORDS}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Published" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, status: "published" });
    rerender(
      <FaqFormFields
        values={values}
        onChange={onChange}
        categories={categories}
        limits={{ question: 300, answer: 5000 }}
        words={FORM_WORDS}
        disabled
      />,
    );
    expect(screen.getByLabelText("Question")).toBeDisabled();
    expect(screen.getByLabelText("Answer")).toBeDisabled();
  });

  it("says to add a category first when there is none, instead of showing an empty box", () => {
    renderWithMessages(
      <FaqFormFields
        values={values}
        onChange={vi.fn()}
        categories={[]}
        limits={{ question: 300, answer: 5000 }}
        words={FORM_WORDS}
      />,
    );
    expect(screen.getByText("Add a category first.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  });
});

function categoryRow(id: string, name: string, extra: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    usage: "No questions",
    hidden: false,
    hiddenLabel: "Hidden",
    edit: { label: `Edit ${name}`, onClick: vi.fn() },
    toggle: { label: `Hide ${name}`, onClick: vi.fn(), hide: true },
    remove: { label: `Delete ${name}`, onClick: vi.fn() },
    moveUp: { label: `Move ${name} up`, onClick: vi.fn() },
    moveDown: { label: `Move ${name} down`, onClick: vi.fn() },
    ...extra,
  };
}

function categoryForm(extra: Partial<CategoryFormProps> = {}): CategoryFormProps {
  return {
    title: "Add category",
    values: { name: "", slug: "", active: true },
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    words: {
      name: "Name",
      slug: "Address word",
      slugHint: "Lowercase words.",
      active: "Show on the site",
      activeHint: "Hidden ones are not shown.",
      submit: "Add category",
      cancel: "Cancel",
    },
    ...extra,
  };
}

describe("CategoryManager (ADR-143): the category drawer's body", () => {
  it("lists each category with its slug and use, and says Hidden in words", () => {
    renderWithMessages(
      <CategoryManager
        rows={[
          categoryRow("1", "Buyers", { usage: "12 questions" }),
          categoryRow("2", "Sellers", { hidden: true }),
        ]}
        listLabel="FAQ categories"
        emptyText="None yet."
        form={categoryForm()}
      />,
    );
    const list = screen.getByRole("list", { name: "FAQ categories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("12 questions")).toBeInTheDocument();
    expect(within(list).getByText("Hidden")).toBeInTheDocument();
  });

  it("names every icon button in full and calls the right handler", () => {
    const row = categoryRow("1", "Buyers");
    renderWithMessages(
      <CategoryManager
        rows={[row]}
        listLabel="FAQ categories"
        emptyText="None."
        form={categoryForm()}
      />,
    );
    for (const [name, handler] of [
      ["Move Buyers up", row.moveUp.onClick],
      ["Move Buyers down", row.moveDown.onClick],
      ["Edit Buyers", row.edit.onClick],
      ["Hide Buyers", row.toggle.onClick],
      ["Delete Buyers", row.remove.onClick],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it("turns Delete off, with the reason in words, for a category that still holds items", () => {
    renderWithMessages(
      <CategoryManager
        rows={[
          categoryRow("1", "Buyers", {
            remove: {
              label: "Delete Buyers",
              onClick: vi.fn(),
              disabled: true,
              reason: "Move its questions first.",
            },
          }),
        ]}
        listLabel="FAQ categories"
        emptyText="None."
        form={categoryForm()}
      />,
    );
    expect(screen.getByRole("button", { name: "Delete Buyers" })).toBeDisabled();
    expect(screen.getByText("Move its questions first.")).toBeInTheDocument();
  });

  it("says so when there are none", () => {
    renderWithMessages(
      <CategoryManager
        rows={[]}
        listLabel="FAQ categories"
        emptyText="None yet."
        form={categoryForm()}
      />,
    );
    expect(screen.getByText("None yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("sends the form on submit, reports each box's change, and does nothing twice while saving", () => {
    const form = categoryForm({ values: { name: "Agents", slug: "agents", active: true } });
    const { rerender } = renderWithMessages(
      <CategoryManager rows={[]} listLabel="x" emptyText="None." form={form} />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Agents and brokers" } });
    expect(form.onChange).toHaveBeenLastCalledWith({
      name: "Agents and brokers",
      slug: "agents",
      active: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(form.onSubmit).toHaveBeenCalledOnce();
    rerender(
      <CategoryManager
        rows={[]}
        listLabel="x"
        emptyText="None."
        form={{ ...form, pending: true }}
      />,
    );
    expect(screen.getByLabelText("Name")).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Add category" }));
    expect(form.onSubmit).toHaveBeenCalledOnce();
  });

  it("shows problems beside their boxes, an alert for the whole form, and Cancel only while editing", () => {
    const { rerender } = renderWithMessages(
      <CategoryManager
        rows={[]}
        listLabel="x"
        emptyText="None."
        form={categoryForm({
          errors: { name: "Use at least 2 characters.", form: "It could not be saved." },
        })}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("It could not be saved.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    const onCancel = vi.fn();
    rerender(
      <CategoryManager
        rows={[]}
        listLabel="x"
        emptyText="None."
        form={categoryForm({ onCancel, title: "Edit category Buyers" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
