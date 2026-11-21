"use client";

import { useState } from "react";
import { BlogBlockEditor } from "@/components/domain/blog-block-editor";
import type { BlogBlock } from "@/components/domain/blog-blocks";
import { BlogPostForm, type BlogPostFormValues } from "@/components/domain/blog-post-form";
import {
  BlogPostRows,
  type BlogListTab,
  type BlogPostRow,
  type BlogRowAction,
} from "@/components/domain/blog-post-rows";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";
import { BLOG_IMAGE_URL } from "./blog-demos";

const ALL_KINDS: BlogBlock[] = [
  { type: "heading", level: 2, text: "What you pay besides the price" },
  {
    type: "paragraph",
    text: "Buying a flat is mostly paperwork. Most of the money goes to the seller.",
  },
  { type: "list", ordered: false, items: ["Stamp duty on the sale deed", "Registration charges"] },
  {
    type: "quote",
    text: "Never pay in cash without a receipt.",
    cite: "A Chennai property lawyer",
  },
  {
    type: "image",
    path: "home-a.svg",
    alt: "Drawn placeholder: a house with a pitched roof",
    caption: "A drawn placeholder",
  },
];

function EditorTryIt({
  start,
  max,
  disabled,
}: {
  start: BlogBlock[];
  max?: number;
  disabled?: boolean;
}) {
  const [blocks, setBlocks] = useState<BlogBlock[]>(start);
  return (
    <div className="w-full max-w-3xl">
      <BlogBlockEditor
        blocks={blocks}
        onChange={setBlocks}
        imageUrl={BLOG_IMAGE_URL}
        onChooseImage={(index) =>
          setBlocks((current) =>
            current.map((block, place) =>
              place === index && block.type === "image" ? { ...block, path: "home-b.svg" } : block,
            ),
          )
        }
        {...(max === undefined ? {} : { max })}
        {...(disabled === undefined ? {} : { disabled })}
      />
    </div>
  );
}

export function BlogBlockEditorDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The editor of the body of an article (ADR-143, ADR-144): the admin adds a block of each
        kind, writes its fields, moves it up or down and deletes it. There is no markup to learn,
        and no HTML, markdown or rich text is stored. A picture block has a required description and
        an optional caption; choosing the file is done by the page. All wording is draft wording for
        the owner to approve.
      </Text>
      <Specimen label="Try it: add, move and delete blocks, change a heading's size, a list's style, choose a picture">
        <EditorTryIt start={ALL_KINDS} />
      </Specimen>
      <Specimen label="Empty: a first block is asked for">
        <EditorTryIt start={[]} />
      </Specimen>
      <Specimen label="Problems on two blocks, and a picture not chosen yet">
        <div className="w-full max-w-3xl">
          <BlogBlockEditor
            blocks={[
              { type: "paragraph", text: "" },
              { type: "image", path: "", alt: "" },
              { type: "heading", level: 3, text: "A sub-heading" },
            ]}
            onChange={() => undefined}
            imageUrl={BLOG_IMAGE_URL}
            onChooseImage={() => undefined}
            errors={{ 0: "Write some text or delete this block.", 1: "Describe the picture." }}
          />
        </div>
      </Specimen>
      <Specimen label="Full (3 blocks of 3): the Add buttons are off and say why">
        <EditorTryIt start={ALL_KINDS.slice(0, 3)} max={3} />
      </Specimen>
      <Specimen label="Disabled while saving">
        <EditorTryIt start={ALL_KINDS.slice(0, 2)} disabled />
      </Specimen>
    </div>
  );
}

const ROWS: BlogPostRow[] = [
  {
    id: "a1",
    title: "A first-time buyer's guide to registration charges in Chennai",
    slug: "first-time-buyer-registration-charges",
    status: "published",
    trashed: false,
    categoryName: "Buying guide",
    authorName: "Asha Rao",
    updatedAt: "2026-03-02T10:00:00+05:30",
    editHref: "#edit-a1",
  },
  {
    id: "a2",
    title: "Renting in Velachery: what to check in the lease",
    slug: "renting-in-velachery",
    status: "draft",
    trashed: false,
    categoryName: "Renting",
    authorName: "Karthik Subramanian",
    updatedAt: "2026-03-01T10:00:00+05:30",
    editHref: "#edit-a2",
  },
  {
    id: "a3",
    title: "Market note, spring 2025",
    slug: "market-note-spring-2025",
    status: "archived",
    trashed: false,
    categoryName: null,
    authorName: "Asha Rao",
    updatedAt: "2026-01-14T10:00:00+05:30",
    editHref: "#edit-a3",
  },
  {
    id: "a4",
    title:
      "Pre-registration-documentation-checklist-for-a-multi-storey-apartment-purchase-in-Tamil-Nadu",
    slug: "pre-registration-documentation-checklist-for-a-multi-storey-apartment-purchase-in-tamil-nadu",
    status: "draft",
    trashed: true,
    categoryName: "Documents",
    authorName: "A writer with a rather long name indeed",
    updatedAt: "2025-12-20T10:00:00+05:30",
    editHref: "#edit-a4",
  },
];

const TABS = (): { value: BlogListTab; count: number; href: string }[] => [
  { value: "all", count: 3, href: "#all" },
  { value: "draft", count: 1, href: "#draft" },
  { value: "published", count: 1, href: "#published" },
  { value: "archived", count: 1, href: "#archived" },
  { value: "trash", count: 1, href: "#trash" },
];

const SEARCH = {
  action: "#list",
  categories: [
    { id: "c1", name: "Buying guide" },
    { id: "c2", name: "Renting" },
    { id: "c3", name: "Investment tips" },
  ],
};

function RowsTryIt() {
  const [rows, setRows] = useState<BlogPostRow[]>(ROWS.slice(0, 3));
  const [pendingId, setPendingId] = useState<string | undefined>(undefined);
  const act = (id: string, action: BlogRowAction) => {
    setPendingId(id);
    window.setTimeout(() => {
      setRows((current) =>
        current.flatMap((row) => {
          if (row.id !== id) return [row];
          if (action === "trash") return [];
          if (action === "publish") return [{ ...row, status: "published" as const }];
          if (action === "unpublish") return [{ ...row, status: "draft" as const }];
          if (action === "archive") return [{ ...row, status: "archived" as const }];
          return [row];
        }),
      );
      setPendingId(undefined);
    }, 600);
  };
  return (
    <div className="w-full max-w-5xl">
      <BlogPostRows
        tabs={TABS()}
        tab="all"
        search={SEARCH}
        rows={rows}
        onAction={act}
        pendingId={pendingId}
        countText={`${rows.length} articles`}
      />
    </div>
  );
}

export function BlogPostRowsDemo() {
  const none = () => undefined;
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The admin list of articles (ADR-143 section 5): tabs by status with counts, a search box and
        a category filter, and a row for each article with its status as a word, its address and the
        buttons that fit its state: Publish or Unpublish, Archive, Move to Trash, and Restore in
        Trash. The tabs, the search and the filter are links and a form, so a filtered list has its
        own address. All wording is draft wording for the owner to approve. Made-up articles.
      </Text>
      <Specimen label="Try it: publish, unpublish, archive and move to Trash (each takes a moment, the row's buttons are busy)">
        <RowsTryIt />
      </Specimen>
      <Specimen label="The Trash tab: only Restore, no Edit; a very long title and address wrap">
        <div className="w-full max-w-5xl">
          <BlogPostRows
            tabs={TABS()}
            tab="trash"
            search={SEARCH}
            rows={[ROWS[3] as BlogPostRow]}
            onAction={none}
            countText="1 article in Trash"
          />
        </div>
      </Specimen>
      <Specimen label="A search with no match">
        <div className="w-full max-w-5xl">
          <BlogPostRows
            tabs={TABS()}
            tab="all"
            search={{ ...SEARCH, query: "stamp duty", categoryId: "c2" }}
            rows={[]}
            onAction={none}
          />
        </div>
      </Specimen>
      <Specimen label="No articles yet">
        <div className="w-full max-w-5xl">
          <BlogPostRows
            tabs={TABS().map((tab) => ({ ...tab, count: 0 }))}
            tab="all"
            search={SEARCH}
            rows={[]}
            onAction={none}
          />
        </div>
      </Specimen>
      <Specimen label="A failed action: the message sits above the list and the list stays as it was">
        <div className="w-full max-w-5xl">
          <BlogPostRows
            tabs={TABS()}
            tab="all"
            search={SEARCH}
            rows={ROWS.slice(0, 2)}
            onAction={none}
            error="We could not publish this article. Try again."
          />
        </div>
      </Specimen>
    </div>
  );
}

const FILLED: BlogPostFormValues = {
  title: "A first-time buyer's guide to registration charges in Chennai",
  slug: "first-time-buyer-registration-charges",
  authorName: "Asha Rao",
  categoryId: "c1",
  tags: ["home-loans", "chennai", "registration"],
  excerpt:
    "What you pay on top of the price of a flat, who collects it and when, with a worked example.",
  seoTitle: "",
  seoDescription: "",
  blocks: ALL_KINDS,
  coverAlt: "Drawn placeholder: a house with a pitched roof",
};

const BLANK: BlogPostFormValues = {
  title: "",
  slug: "",
  authorName: "",
  categoryId: "",
  tags: [],
  excerpt: "",
  seoTitle: "",
  seoDescription: "",
  blocks: [],
  coverAlt: "",
};

const CATEGORIES = [
  { id: "c1", name: "Buying guide" },
  { id: "c2", name: "Renting" },
  { id: "c3", name: "Investment tips" },
];

function FormTryIt({
  start,
  cover,
  published,
  errors,
  blockErrors,
  disabled,
}: {
  start: BlogPostFormValues;
  cover?: string | null;
  published?: boolean;
  errors?: Partial<Record<string, string>>;
  blockErrors?: Record<number, string>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState(start);
  const [coverUrl, setCoverUrl] = useState<string | null>(cover ?? null);
  return (
    <div className="w-full max-w-4xl">
      <BlogPostForm
        values={values}
        onChange={setValues}
        categories={CATEGORIES}
        coverUrl={coverUrl}
        imageUrl={BLOG_IMAGE_URL}
        onChooseCover={() => setCoverUrl(BLOG_IMAGE_URL("home-a.svg"))}
        onRemoveCover={() => setCoverUrl(null)}
        onChooseImage={(index) =>
          setValues((current) => ({
            ...current,
            blocks: current.blocks.map((block, place) =>
              place === index && block.type === "image" ? { ...block, path: "home-b.svg" } : block,
            ),
          }))
        }
        onSuggestSlug={() =>
          setValues((current) => ({
            ...current,
            slug: current.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 120),
          }))
        }
        {...(published === undefined ? {} : { published })}
        {...(errors === undefined ? {} : { errors })}
        {...(blockErrors === undefined ? {} : { blockErrors })}
        {...(disabled === undefined ? {} : { disabled })}
      />
    </div>
  );
}

export function BlogPostFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The boxes of the Blog editor (ADR-143 section 5), in four sections: Basics (title, address,
        author, category, tags and summary), the cover picture with its required description, the
        body (the block editor) and the search description with a preview of how it may read. The
        save bar is the one of the project form. All wording is draft wording for the owner to
        approve. Made-up article.
      </Text>
      <Specimen label="Try it: a published article with a cover (the address box warns that changing it breaks links; Make from title; the search preview follows what is typed)">
        <FormTryIt start={FILLED} cover={BLOG_IMAGE_URL("home-a.svg")} published />
      </Specimen>
      <Specimen label="A new draft: everything empty, no cover, no category">
        <FormTryIt start={BLANK} />
      </Specimen>
      <Specimen label="With problems on the boxes and on one block">
        <FormTryIt
          start={{
            ...FILLED,
            title: "",
            slug: "Not A Slug",
            authorName: "",
            blocks: [{ type: "paragraph", text: "" }],
          }}
          cover={BLOG_IMAGE_URL("home-a.svg")}
          errors={{
            title: "This field is required.",
            slug: "Use lower case letters, numbers and single hyphens, from 2 to 120 characters.",
            authorName: "This field is required.",
            coverAlt: "This field is required.",
            body: "Fix the problems marked in the text.",
          }}
          blockErrors={{ 0: "Write some text or delete this block." }}
        />
      </Specimen>
      <Specimen label="Disabled while saving">
        <FormTryIt start={FILLED} cover={BLOG_IMAGE_URL("home-a.svg")} disabled />
      </Specimen>
    </div>
  );
}
