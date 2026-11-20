// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogPostForm, type BlogPostFormValues } from "../blog-post-form";
import { BlogPostRows, type BlogListTab, type BlogPostRow } from "../blog-post-rows";

const imageUrl = (path: string) => `/pictures/${path}.svg`;

const ROW = (overrides: Partial<BlogPostRow> = {}): BlogPostRow => ({
  id: "a1",
  title: "A guide",
  slug: "a-guide",
  status: "draft",
  trashed: false,
  categoryName: "Buying guide",
  authorName: "Asha Rao",
  updatedAt: "2026-03-02T10:00:00+05:30",
  editHref: "/admin/blog/a1",
  ...overrides,
});

const TABS: { value: BlogListTab; count: number; href: string }[] = [
  { value: "all", count: 4, href: "/admin/blog" },
  { value: "draft", count: 2, href: "/admin/blog?status=draft" },
  { value: "published", count: 1, href: "/admin/blog?status=published" },
  { value: "archived", count: 1, href: "/admin/blog?status=archived" },
  { value: "trash", count: 3, href: "/admin/blog?status=trash" },
];

const SEARCH = { action: "/admin/blog", categories: [{ id: "c1", name: "Buying guide" }] };

function renderRows(rows: BlogPostRow[], props: Partial<Parameters<typeof BlogPostRows>[0]> = {}) {
  const onAction = vi.fn();
  renderWithMessages(
    <BlogPostRows
      tabs={TABS}
      tab="all"
      search={SEARCH}
      rows={rows}
      onAction={onAction}
      {...props}
    />,
  );
  return { onAction };
}

describe("BlogPostRows: the admin's list of articles (ADR-143)", () => {
  it("marks the current tab with aria-current and shows each count", () => {
    renderRows([ROW()], { tab: "draft" });
    const tab = screen.getByRole("link", { name: /Drafts/ });
    expect(tab).toHaveAttribute("aria-current", "page");
    expect(within(tab).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Published/ })).not.toHaveAttribute("aria-current");
  });

  it("is a search form that keeps the tab, with a labelled box and a category filter", () => {
    renderRows([ROW()], { tab: "draft", search: { ...SEARCH, query: "stamp", categoryId: "c1" } });
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form.querySelector("input[type='hidden'][name='status']")).toHaveAttribute(
      "value",
      "draft",
    );
    expect(screen.getByLabelText("Search articles")).toHaveValue("stamp");
    expect(form.querySelector("input[type='hidden'][name='category']")).toHaveAttribute(
      "value",
      "c1",
    );
  });

  it("shows a draft's status as a word, its address and Publish, Archive and Move to Trash", () => {
    const { onAction } = renderRows([ROW()]);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("/blog/a-guide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Publish/ }));
    expect(onAction).toHaveBeenCalledWith("a1", "publish");
    fireEvent.click(screen.getByRole("button", { name: /^Archive/ }));
    expect(onAction).toHaveBeenLastCalledWith("a1", "archive");
    fireEvent.click(screen.getByRole("button", { name: /^Move to Trash/ }));
    expect(onAction).toHaveBeenLastCalledWith("a1", "trash");
  });

  it("offers Unpublish instead of Publish for a published article, and no Archive for an archived one", () => {
    const { onAction } = renderRows([ROW({ status: "published" })]);
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Unpublish/ }));
    expect(onAction).toHaveBeenCalledWith("a1", "unpublish");
    expect(document.querySelector("[data-status='published']")).toHaveTextContent("Published");
  });

  it("offers only Restore, and no Edit, for an article in Trash", () => {
    const { onAction } = renderRows([ROW({ trashed: true })], { tab: "trash" });
    expect(screen.getByText("In Trash")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Restore/ }));
    expect(onAction).toHaveBeenCalledWith("a1", "restore");
  });

  it("names the article in every button, because several rows share a word", () => {
    renderRows([ROW(), ROW({ id: "a2", title: "Another" })]);
    expect(screen.getByRole("button", { name: "Publish A guide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Another" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit A guide" })).toHaveAttribute(
      "href",
      "/admin/blog/a1",
    );
  });

  it("makes the working row's buttons busy and turns the other rows' buttons off", () => {
    renderRows([ROW(), ROW({ id: "a2", title: "Another" })], { pendingId: "a1" });
    expect(screen.getByRole("button", { name: "Publish A guide" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Publish Another" })).toBeDisabled();
  });

  it("says nothing matches when a search or filter is on, and that there are none yet otherwise", () => {
    const { unmount } = renderWithMessages(
      <BlogPostRows
        tabs={TABS}
        tab="all"
        search={{ ...SEARCH, query: "zzz" }}
        rows={[]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText("No article matches")).toBeInTheDocument();
    unmount();
    renderRows([]);
    expect(screen.getByText("No articles yet")).toBeInTheDocument();
  });

  it("shows a failed action as an alert above the list", () => {
    renderRows([ROW()], { error: "We could not publish this article. Try again." });
    expect(screen.getByRole("alert")).toHaveTextContent("We could not publish this article.");
  });
});

const VALUES: BlogPostFormValues = {
  title: "A guide",
  slug: "a-guide",
  authorName: "Asha Rao",
  categoryId: "c1",
  tags: ["chennai"],
  excerpt: "A summary.",
  seoTitle: "",
  seoDescription: "",
  blocks: [{ type: "paragraph", text: "Some words." }],
  coverAlt: "A bright flat",
};

function renderForm(props: Partial<Parameters<typeof BlogPostForm>[0]> = {}) {
  const onChange = vi.fn();
  renderWithMessages(
    <BlogPostForm
      values={VALUES}
      onChange={onChange}
      categories={[
        { id: "c1", name: "Buying guide" },
        { id: "c2", name: "Renting" },
      ]}
      coverUrl={null}
      imageUrl={imageUrl}
      onChooseCover={vi.fn()}
      onRemoveCover={vi.fn()}
      onChooseImage={vi.fn()}
      {...props}
    />,
  );
  return { onChange };
}

describe("BlogPostForm: the boxes of the editor (ADR-143)", () => {
  it("has the four sections, each a named region", () => {
    renderForm();
    for (const name of ["Basics", "Cover picture", "Article text", "Search description"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("passes a typed change up with the other values kept", () => {
    const { onChange } = renderForm();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A better guide" } });
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, title: "A better guide" });
    fireEvent.change(screen.getByLabelText("Author name"), { target: { value: "Karthik" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, authorName: "Karthik" });
  });

  it("makes the address from the title only when asked, and warns when the article is on the site", () => {
    const suggest = vi.fn();
    renderForm({ onSuggestSlug: suggest, published: true });
    fireEvent.click(screen.getByRole("button", { name: "Make from title" }));
    expect(suggest).toHaveBeenCalled();
    expect(screen.getByText(/Changing its address breaks links/)).toBeInTheDocument();
  });

  it("asks for the cover's description only once there is a cover", () => {
    const { unmount } = renderWithMessages(
      <BlogPostForm
        values={VALUES}
        onChange={vi.fn()}
        categories={[]}
        coverUrl={null}
        imageUrl={imageUrl}
        onChooseCover={vi.fn()}
        onRemoveCover={vi.fn()}
        onChooseImage={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Describe the cover")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose cover" })).toBeInTheDocument();
    unmount();
    const remove = vi.fn();
    renderForm({ coverUrl: "/pictures/home-a.svg", onRemoveCover: remove });
    expect(screen.getByLabelText("Describe the cover")).toHaveValue("A bright flat");
    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    expect(remove).toHaveBeenCalled();
  });

  it("shows a problem tied to its box, and the counters", () => {
    renderForm({ errors: { title: "This field is required." } });
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("10 / 320")).toBeInTheDocument();
  });

  it("previews the search result from the search title and description, falling back to the title and summary", () => {
    const { unmount } = renderWithMessages(
      <BlogPostForm
        values={VALUES}
        onChange={vi.fn()}
        categories={[]}
        coverUrl={null}
        imageUrl={imageUrl}
        onChooseCover={vi.fn()}
        onRemoveCover={vi.fn()}
        onChooseImage={vi.fn()}
      />,
    );
    const preview = document.querySelector("[data-slot='blog-seo-preview']") as HTMLElement;
    expect(within(preview).getByText("A guide")).toBeInTheDocument();
    expect(within(preview).getByText("A summary.")).toBeInTheDocument();
    expect(within(preview).getByText("/blog/a-guide")).toBeInTheDocument();
    unmount();
    renderForm({
      values: { ...VALUES, seoTitle: "Registration charges", seoDescription: "What you pay." },
    });
    const next = document.querySelector("[data-slot='blog-seo-preview']") as HTMLElement;
    expect(within(next).getByText("Registration charges")).toBeInTheDocument();
    expect(within(next).getByText("What you pay.")).toBeInTheDocument();
  });

  it("turns every box off while saving", () => {
    renderForm({ disabled: true });
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add paragraph" })).toBeDisabled();
  });
});
