"use client";

import { useState } from "react";
import {
  CategoryManager,
  type CategoryFormProps,
  type CategoryRow,
} from "@/components/domain/category-manager";
import {
  FaqFormFields,
  type FaqFormErrors,
  type FaqFormValues,
  type FaqFormWords,
} from "@/components/domain/faq-form-fields";
import { FaqManager, type FaqManagerProps, type FaqRow } from "@/components/domain/faq-manager";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The FAQ admin's parts (ADR-143): the list of questions, the edit form with the shared save bar, and the category
 * manager that opens in a drawer (the same part serves the Blog and Careers). Plain English text and made-up questions;
 * nothing here goes anywhere. All wording is draft wording for the owner to approve.
 */

const NOTHING = () => undefined;

const CATEGORY_OPTIONS = [
  { value: "buyers", label: "Buyers" },
  { value: "sellers", label: "Sellers" },
  { value: "tenants", label: "Tenants" },
];

/* The list */

type Sample = {
  id: string;
  question: string;
  category: string;
  status: "published" | "draft";
  trashed?: boolean;
  updated: string;
};

const SAMPLES: Sample[] = [
  {
    id: "a",
    question: "How do I contact the owner of a home?",
    category: "Buyers",
    status: "published",
    updated: "20 Nov 2026",
  },
  {
    id: "b",
    question: "Which papers should I ask to see before I pay anything?",
    category: "Buyers",
    status: "published",
    updated: "18 Nov 2026",
  },
  {
    id: "c",
    question: "Can I save homes and compare them later?",
    category: "Buyers",
    status: "draft",
    updated: "17 Nov 2026",
  },
  {
    id: "d",
    question:
      "What happens to my details when I delete my account, and how long do you keep a record of the messages I sent to owners?",
    category: "Platform and a very long category name",
    status: "published",
    updated: "2 Nov 2026",
  },
];

function rowsFor(samples: Sample[], options: { order?: boolean; trash?: boolean } = {}): FaqRow[] {
  return samples.map((sample, index) => ({
    id: sample.id,
    question: sample.question,
    categoryName: sample.category,
    status: sample.status,
    statusLabel: options.trash
      ? "In the Trash"
      : sample.status === "published"
        ? "Published"
        : "Draft",
    updated: sample.updated,
    ...(options.trash ? { trashed: true } : {}),
    editHref: `#edit-${sample.id}`,
    editLabel: "Edit",
    editFor: `question: ${sample.question}`,
    toggle: {
      label: options.trash ? "Restore" : sample.status === "published" ? "Unpublish" : "Publish",
      forName: `question: ${sample.question}`,
      onClick: NOTHING,
    },
    ...(options.trash
      ? {}
      : { trash: { label: `Move to Trash: ${sample.question}`, onClick: NOTHING } }),
    ...(options.order
      ? {
          moveUp: {
            label: `Move up: ${sample.question}`,
            onClick: NOTHING,
            disabled: index === 0,
          },
          moveDown: {
            label: `Move down: ${sample.question}`,
            onClick: NOTHING,
            disabled: index === samples.length - 1,
          },
        }
      : {}),
  }));
}

function managerProps(overrides: Partial<FaqManagerProps> = {}): FaqManagerProps {
  return {
    title: "FAQ",
    intro: "Questions and answers shown on the public FAQ page and to the assistant.",
    addLabel: "Add question",
    addHref: "#new-question",
    categoriesLabel: "Categories",
    onCategories: NOTHING,
    tabs: {
      label: "Show",
      options: [
        { value: "all", label: "All", count: 4 },
        { value: "published", label: "Published", count: 3 },
        { value: "draft", label: "Drafts", count: 1 },
        { value: "trash", label: "Trash", count: 2 },
      ],
      value: "all",
      onChange: NOTHING,
    },
    category: {
      label: "Category",
      allLabel: "All categories",
      options: CATEGORY_OPTIONS,
      value: "",
      onChange: NOTHING,
    },
    search: {
      value: "",
      onChange: NOTHING,
      label: "Search the questions and answers",
      placeholder: "Search questions and answers",
    },
    columns: {
      question: "Question",
      category: "Category",
      status: "Status",
      updated: "Updated",
      actions: "Actions",
    },
    caption: "FAQ questions",
    rows: rowsFor(SAMPLES),
    countText: "4 of 4 questions",
    empty: {
      title: "No questions yet",
      text: "Add the first question. Visitors see it once you publish it.",
    },
    noMatches: {
      title: "No questions match",
      text: "Try other words, or choose All categories.",
    },
    ...overrides,
  };
}

function ListTryIt() {
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const visible = SAMPLES.filter(
    (sample) =>
      (tab === "all" ||
        tab === "trash" ||
        (tab === "published" ? sample.status === "published" : sample.status === "draft")) &&
      (category === "" || sample.category.toLowerCase() === category) &&
      sample.question.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const base = managerProps();
  return (
    <FaqManager
      {...base}
      tabs={{ ...base.tabs, value: tab, onChange: setTab }}
      category={{ ...base.category, value: category, onChange: setCategory }}
      search={{ ...base.search, value: query, onChange: setQuery }}
      rows={tab === "trash" ? [] : rowsFor(visible, { order: category !== "" })}
      countText={`${visible.length} of 4 questions`}
      {...(category !== ""
        ? {}
        : { note: "Choose a category to change the order of its questions." })}
    />
  );
}

export function FaqManagerDemo() {
  const trashed = SAMPLES.slice(2, 3);
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The admin&apos;s FAQ list (ADR-143): tabs for All, Published, Drafts and Trash, a category
        filter, a search, a table that becomes cards on a phone, and on each row Edit, Publish or
        Unpublish, Move to Trash and (when one category is chosen) the order buttons. Trash is
        reversible: a restored question comes back as a draft. All wording is draft wording for the
        owner to approve. Made-up questions.
      </Text>
      <Specimen label="Try it: switch the tab, choose a category (the order buttons appear), type in the search">
        <div className="w-full max-w-6xl">
          <ListTryIt />
        </div>
      </Specimen>
      <Specimen label="One category chosen: the order buttons show; the first Move up and the last Move down are off">
        <div className="w-full max-w-6xl">
          <FaqManager
            {...managerProps({
              category: { ...managerProps().category, value: "buyers" },
              rows: rowsFor(SAMPLES.slice(0, 3), { order: true }),
              countText: "3 of 4 questions",
            })}
          />
        </div>
      </Specimen>
      <Specimen label="The Trash tab: Restore, no Edit, no order buttons">
        <div className="w-full max-w-6xl">
          <FaqManager
            {...managerProps({
              tabs: { ...managerProps().tabs, value: "trash" },
              rows: rowsFor(trashed, { trash: true }),
              countText: "1 of 2 questions in the Trash",
            })}
          />
        </div>
      </Specimen>
      <Specimen label="Nothing yet, and no match for a search">
        <div className="flex w-full max-w-6xl flex-col gap-10">
          <FaqManager {...managerProps({ rows: [], countText: "0 questions" })} />
          <FaqManager
            {...managerProps({
              rows: [],
              search: { ...managerProps().search, value: "zzzz" },
              countText: "0 questions",
            })}
          />
        </div>
      </Specimen>
    </div>
  );
}

/* The edit form */

const FORM_WORDS: FaqFormWords = {
  content: {
    title: "Question and answer",
    description: "What a visitor reads on the FAQ page.",
  },
  publishing: {
    title: "Publishing",
    description: "A draft is saved but not shown on the site or to the assistant.",
  },
  category: "Category",
  categoryPlaceholder: "Choose a category",
  noCategory: "There are no FAQ categories yet. Add one from Categories on the FAQ list first.",
  question: "Question",
  questionHint: "One line, as a visitor would ask it.",
  answer: "Answer",
  answerHint: "Plain text. Leave a blank line between paragraphs.",
  answerCounter: (count, max) => `${count} / ${max}`,
  status: "Status",
  statusDraft: "Draft",
  statusPublished: "Published",
  statusHint: "Publishing shows the question on the FAQ page straight away.",
};

const EMPTY: FaqFormValues = { categoryId: "", question: "", answer: "", status: "draft" };
const FILLED: FaqFormValues = {
  categoryId: "buyers",
  question: "Which papers should I ask to see before I pay anything?",
  answer:
    "Ask for the sale deed, the latest tax receipt and an encumbrance certificate.\n\nCheck that the name on the deed matches the person you are speaking to.",
  status: "published",
};

function FormSpecimen({
  initial,
  errors,
  categories = CATEGORY_OPTIONS,
  saving = false,
  note = "Saving shows the change on the site at once.",
}: {
  initial: FaqFormValues;
  errors?: FaqFormErrors;
  categories?: typeof CATEGORY_OPTIONS;
  saving?: boolean;
  note?: string;
}) {
  const [values, setValues] = useState(initial);
  return (
    <form
      noValidate
      onSubmit={(event) => event.preventDefault()}
      className="flex w-full max-w-3xl flex-col gap-6"
    >
      <FaqFormFields
        values={values}
        onChange={setValues}
        categories={categories}
        limits={{ question: 300, answer: 5000 }}
        disabled={saving}
        words={FORM_WORDS}
        {...(errors ? { errors } : {})}
      />
      <ProjectSaveBar
        note={note}
        words={{ cancel: "Cancel", save: "Save question", saving: "Saving" }}
        saving={saving}
        sticky={false}
        onCancel={NOTHING}
        className="rounded-xl border"
      />
    </form>
  );
}

export function FaqFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The admin&apos;s question page (ADR-143): the category, the question, the answer and whether
        it is a draft or published, above the save bar the project form uses. Wording is draft
        wording for the owner to approve.
      </Text>
      <Specimen label="A new question: empty, a draft (try typing: the answer counter follows)">
        <FormSpecimen
          initial={EMPTY}
          note="A new question is saved as a draft until you publish it."
        />
      </Specimen>
      <Specimen label="A published question being edited">
        <FormSpecimen initial={FILLED} />
      </Specimen>
      <Specimen label="Problems on the boxes">
        <FormSpecimen
          initial={{ ...EMPTY, question: "Why" }}
          errors={{
            categoryId: "Choose a category.",
            question: "Use at least 5 characters.",
            answer: "This field is required.",
          }}
        />
      </Specimen>
      <Specimen label="Saving (every box is off) and no category yet">
        <div className="flex w-full flex-col gap-10">
          <FormSpecimen initial={FILLED} saving />
          <FormSpecimen initial={EMPTY} categories={[]} />
        </div>
      </Specimen>
    </div>
  );
}

/* The category manager */

const CATEGORY_NAMES: { id: string; name: string; slug: string; used: number; hidden?: boolean }[] =
  [
    { id: "c1", name: "Buyers", slug: "buyers", used: 12 },
    { id: "c2", name: "Sellers", slug: "sellers", used: 9 },
    { id: "c3", name: "Tenants", slug: "tenants", used: 0 },
    { id: "c4", name: "Platform", slug: "platform", used: 0, hidden: true },
  ];

function categoryRows(editing?: string): CategoryRow[] {
  return CATEGORY_NAMES.map((category, index) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    usage: category.used === 0 ? "No questions" : `${category.used} questions`,
    hidden: category.hidden ?? false,
    hiddenLabel: "Hidden",
    ...(editing === category.id ? { editing: true } : {}),
    edit: { label: `Edit ${category.name}`, onClick: NOTHING },
    toggle: {
      label: `${category.hidden ? "Show" : "Hide"} ${category.name}`,
      onClick: NOTHING,
      hide: !(category.hidden ?? false),
    },
    remove: {
      label: `Delete ${category.name}`,
      onClick: NOTHING,
      ...(category.used > 0
        ? { disabled: true, reason: "Move or delete its questions before you delete it." }
        : {}),
    },
    moveUp: { label: `Move ${category.name} up`, onClick: NOTHING, disabled: index === 0 },
    moveDown: {
      label: `Move ${category.name} down`,
      onClick: NOTHING,
      disabled: index === CATEGORY_NAMES.length - 1,
    },
  }));
}

const FORM_FIELD_WORDS: CategoryFormProps["words"] = {
  name: "Name",
  slug: "Address word",
  slugHint: "Lowercase words joined by hyphens, such as property-owners.",
  active: "Show on the site",
  activeHint: "A hidden category and its questions are not shown to visitors or to the assistant.",
  submit: "Add category",
  cancel: "Cancel",
};

function ManagerSpecimen({
  title,
  initial,
  errors,
  editing,
  pending = false,
  rows = categoryRows(editing),
}: {
  title: string;
  initial: { name: string; slug: string; active: boolean };
  errors?: CategoryFormProps["errors"];
  editing?: string;
  pending?: boolean;
  rows?: CategoryRow[];
}) {
  const [values, setValues] = useState(initial);
  return (
    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-4">
      <CategoryManager
        rows={rows}
        listLabel="FAQ categories"
        emptyText="There are no categories yet. Add the first one below."
        form={{
          title,
          values,
          onChange: setValues,
          onSubmit: NOTHING,
          pending,
          words: {
            ...FORM_FIELD_WORDS,
            submit: editing ? "Save category" : "Add category",
          },
          ...(editing ? { onCancel: NOTHING } : {}),
          ...(errors ? { errors } : {}),
        }}
      />
    </div>
  );
}

function DrawerTryIt() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", slug: "", active: true });
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Categories
      </Button>
      <ManagerDrawer
        open={open}
        onOpenChange={setOpen}
        title="FAQ categories"
        description="Groups of questions on the FAQ page. Blog articles and job departments have their own."
        closeLabel="Close"
        cancelLabel="Close"
      >
        <CategoryManager
          rows={categoryRows()}
          listLabel="FAQ categories"
          emptyText="There are no categories yet."
          form={{
            title: "Add category",
            values,
            onChange: setValues,
            onSubmit: NOTHING,
            words: FORM_FIELD_WORDS,
          }}
        />
      </ManagerDrawer>
    </>
  );
}

export function CategoryManagerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The category manager (ADR-143), the inside of a drawer opened from a Categories button: add,
        rename, order, hide and delete the categories of one list. The same part serves the FAQ, the
        Blog and the job departments. A category that still holds items cannot be deleted, and says
        why. Wording is draft wording for the owner to approve.
      </Text>
      <Specimen label="Try it: the drawer opens from the button">
        <DrawerTryIt />
      </Specimen>
      <Specimen label="Adding: four categories, one hidden, two in use (delete off, with the reason)">
        <ManagerSpecimen title="Add category" initial={{ name: "", slug: "", active: true }} />
      </Specimen>
      <Specimen label="Editing Sellers, with problems on the boxes and a message for the whole form">
        <ManagerSpecimen
          title="Edit category Sellers"
          editing="c2"
          initial={{ name: "S", slug: "Sellers!", active: true }}
          errors={{
            name: "Use at least 2 characters.",
            slug: "Use lowercase words joined by hyphens.",
            form: "The category could not be saved. Try again.",
          }}
        />
      </Specimen>
      <Specimen label="Saving, and a list with no categories yet">
        <div className="flex w-full flex-col gap-10">
          <ManagerSpecimen
            title="Edit category Sellers"
            editing="c2"
            pending
            initial={{ name: "Sellers", slug: "sellers", active: true }}
          />
          <ManagerSpecimen
            title="Add category"
            rows={[]}
            initial={{ name: "Property owners", slug: "property-owners", active: true }}
          />
        </div>
      </Specimen>
    </div>
  );
}
