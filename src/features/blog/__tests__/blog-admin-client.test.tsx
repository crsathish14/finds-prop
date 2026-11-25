// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryView } from "@/features/content-categories";
import en from "@/i18n/messages/en.json";
import { pictureFile } from "../../../../tests/image-files";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogAdminBoard, type BlogBoardActions } from "../blog-admin-board.client";
import { BlogCategoriesPanel, type BlogCategoriesActions } from "../blog-categories-panel.client";
import { BlogEditor, type BlogEditorActions } from "../blog-editor.client";
import type { BlogStorage } from "../blog-storage";
import { BLOG_IMAGE_MAX_BYTES } from "../constants";
import type { AdminBlogPostView, AdminBlogRowView } from "../view";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
const notice = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/notify", () => ({ notify: notice }));

const words = en.admin.blog;
const FAILED = { ok: false as const, code: "INTERNAL" as const };
const POST_ID = "00000000-0000-4000-b500-0000000000a1";

const CATEGORIES: CategoryView[] = [
  { id: "c1", module: "blog", slug: "guides", name: "Guides", sortOrder: 1, active: true },
  { id: "c2", module: "blog", slug: "news", name: "News", sortOrder: 2, active: false },
];

const row = (id: string, extra: Partial<AdminBlogRowView> = {}): AdminBlogRowView => ({
  id,
  slug: `slug-${id}`,
  title: `Article ${id}`,
  status: "draft",
  categoryId: "c1",
  authorName: "Asha Rao",
  tags: [],
  publishedAt: null,
  updatedAt: "2026-11-20T10:00:00Z",
  trashed: false,
  ...extra,
});

const done = (slug = "stamp-duty") => ({
  ok: true as const,
  data: { postId: POST_ID, slug, status: "draft" as const, slugs: [slug] },
});

function boardActions(): BlogBoardActions {
  return {
    publish: vi.fn(async () => done()),
    unpublish: vi.fn(async () => done()),
    archive: vi.fn(async () => done()),
    trash: vi.fn(async () => done()),
    restore: vi.fn(async () => done()),
  };
}

function categoryActions(): BlogCategoriesActions {
  const ok = async () => ({
    ok: true as const,
    data: { categoryId: "c1", module: "blog", slug: "guides" },
  });
  return { create: vi.fn(ok), update: vi.fn(ok), setActive: vi.fn(ok), remove: vi.fn(ok) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

function board(
  extra: Partial<Parameters<typeof BlogAdminBoard>[0]> = {},
  actions = boardActions(),
) {
  renderWithMessages(
    <BlogAdminBoard
      rows={[row("a"), row("b", { status: "published", publishedAt: "2026-11-01T10:00:00Z" })]}
      total={2}
      page={1}
      pageCount={1}
      counts={{ draft: 1, published: 1, archived: 0, trash: 2 }}
      categories={CATEGORIES}
      usage={{ c1: 2 }}
      params={{ status: "all", category: "", query: "", page: 1 }}
      actions={actions}
      categoryActions={categoryActions()}
      {...extra}
    />,
  );
  return actions;
}

describe("BlogAdminBoard (ADR-143): the admin's list", () => {
  it("has the title, the New article link and the Categories button, and lists the rows with their status in words", () => {
    board();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.add })).toHaveAttribute(
      "href",
      "/admin/blog/new",
    );
    expect(screen.getByRole("button", { name: words.categoriesButton })).toBeInTheDocument();
    expect(screen.getAllByText("Article a").length).toBeGreaterThan(0);
    expect(screen.getAllByText(words.list.status.published).length).toBeGreaterThan(0);
    expect(screen.getByText("2 articles")).toBeInTheDocument();
    expect(screen.getAllByText("Guides").length).toBeGreaterThan(0);
  });

  it("counts each tab, 'All' being everything outside the Trash, and links each tab with the other choices kept", () => {
    board({ params: { status: "all", category: "c1", query: "loan", page: 3 } });
    const tabs = screen.getByRole("navigation", { name: words.list.tabsLabel });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All2",
      "Drafts1",
      "Published1",
      "Archived0",
      "Trash2",
    ]);
    expect(links[2]?.getAttribute("href")).toBe("/admin/blog?status=published&category=c1&q=loan");
  });

  it("marks a hidden category in the filter, and pages through the list in the address", () => {
    board({ pageCount: 3, page: 2, params: { status: "draft", category: "", query: "", page: 2 } });
    const pages = screen.getByRole("navigation", { name: en.blog.pagination.label });
    expect(
      within(pages)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toContain("/admin/blog?status=draft&page=3");
    fireEvent.click(screen.getByRole("combobox", { name: words.list.categoryLabel }));
    expect(screen.getByRole("option", { name: "News (hidden)" })).toBeInTheDocument();
  });

  it("publishes a draft, tells the admin and reads the page again", async () => {
    const actions = board();
    fireEvent.click(screen.getByRole("button", { name: /^Publish Article a/ }));
    await waitFor(() => expect(actions.publish).toHaveBeenCalledWith({ postId: "a" }));
    await waitFor(() => expect(notice.success).toHaveBeenCalledWith(words.toast.published));
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("unpublishes, archives, moves to the Trash and restores, each with its own call and message", async () => {
    const actions = board({ params: { status: "all", category: "", query: "", page: 1 } });
    fireEvent.click(screen.getByRole("button", { name: /^Unpublish Article b/ }));
    await waitFor(() => expect(actions.unpublish).toHaveBeenCalledWith({ postId: "b" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.unpublished);
    fireEvent.click(screen.getByRole("button", { name: /^Archive Article a/ }));
    await waitFor(() => expect(actions.archive).toHaveBeenCalledWith({ postId: "a" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.archived);
    fireEvent.click(screen.getByRole("button", { name: /^Move to Trash Article a/ }));
    await waitFor(() => expect(actions.trash).toHaveBeenCalledWith({ postId: "a" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.trashed);
  });

  it("restores from the Trash tab, where the row offers only Restore", async () => {
    const actions = board({
      rows: [row("t", { trashed: true })],
      params: { status: "trash", category: "", query: "", page: 1 },
    });
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Restore Article t/ }));
    await waitFor(() => expect(actions.restore).toHaveBeenCalledWith({ postId: "t" }));
    expect(notice.success).toHaveBeenCalledWith(words.toast.restored);
  });

  it("says why a publish is refused (no summary yet), above the list and in a toast, and does not say it worked", async () => {
    const actions = boardActions();
    actions.publish = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: { excerpt: [{ key: "validation.blogNeedsExcerpt" }] },
    }));
    board({}, actions);
    fireEvent.click(screen.getByRole("button", { name: /^Publish Article a/ }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(en.validation.blogNeedsExcerpt));
    expect(screen.getByRole("alert")).toHaveTextContent(en.validation.blogNeedsExcerpt);
    expect(notice.success).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("says an article that is already gone is gone, and reads the page again", async () => {
    const actions = boardActions();
    actions.trash = vi.fn(async () => ({ ok: false as const, code: "NOT_FOUND" as const }));
    board({}, actions);
    fireEvent.click(screen.getByRole("button", { name: /^Move to Trash Article a/ }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(words.conflict));
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("says another failure in the words of its code", async () => {
    const actions = boardActions();
    actions.publish = vi.fn(async () => FAILED);
    board({}, actions);
    fireEvent.click(screen.getByRole("button", { name: /^Publish Article a/ }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(en.errors.INTERNAL));
  });

  it("opens the categories drawer from its button", () => {
    board();
    fireEvent.click(screen.getByRole("button", { name: words.categoriesButton }));
    expect(screen.getByRole("dialog", { name: words.categories.title })).toBeInTheDocument();
  });
});

function panel(
  extra: Partial<Parameters<typeof BlogCategoriesPanel>[0]> = {},
  actions = categoryActions(),
) {
  renderWithMessages(
    <BlogCategoriesPanel
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

describe("BlogCategoriesPanel (ADR-143): the categories drawer", () => {
  it("lists the categories with their use, Hidden in words, and Delete off for one that holds articles", () => {
    panel();
    const list = screen.getByRole("list", { name: texts.listLabel });
    expect(within(list).getByText("3 articles")).toBeInTheDocument();
    expect(within(list).getByText("No articles")).toBeInTheDocument();
    expect(within(list).getByText(texts.hidden)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Guides" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete News" })).toBeEnabled();
  });

  it("adds a category to the Blog's list, with the address word suggested from the name", async () => {
    const actions = panel();
    fireEvent.change(screen.getByLabelText(texts.form.name), {
      target: { value: "Market trends" },
    });
    expect(screen.getByLabelText(texts.form.slug)).toHaveValue("market-trends");
    fireEvent.click(screen.getByRole("button", { name: texts.form.add }));
    await waitFor(() =>
      expect(actions.create).toHaveBeenCalledWith({
        module: "blog",
        name: "Market trends",
        slug: "market-trends",
        sortOrder: 3,
        active: true,
      }),
    );
    expect(notice.success).toHaveBeenCalledWith(texts.toast.created);
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("asks before deleting, and deletes only on the answer", async () => {
    const actions = panel();
    fireEvent.click(screen.getByRole("button", { name: "Delete News" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: texts.delete.confirm }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ categoryId: "c2" }));
    expect(notice.success).toHaveBeenCalledWith(texts.toast.deleted);
  });
});

const STORED: AdminBlogPostView = {
  ...row(POST_ID, { slug: "stamp-duty", title: "Stamp duty", status: "published" }),
  excerpt: "A summary.",
  body: [{ type: "paragraph", text: "Stored words." }],
  coverPath: `blog/${POST_ID}/cover.png`,
  coverUrl: "https://files.test/cover.png",
  coverAlt: "A house",
  seoTitle: null,
  seoDescription: null,
  createdAt: "2026-11-01T10:00:00Z",
  publishedAt: "2026-11-02T10:00:00Z",
};

function storageStub(): BlogStorage & { uploaded: string[] } {
  const uploaded: string[] = [];
  return {
    uploaded,
    upload: vi.fn(async (path: string) => {
      uploaded.push(path);
      return true;
    }),
    remove: vi.fn(async () => undefined),
  };
}

function editor(extra: Partial<Parameters<typeof BlogEditor>[0]> = {}) {
  const actions: BlogEditorActions = {
    create: vi.fn(async () => done("made-slug")),
    update: vi.fn(async () => done()),
    setCover: vi.fn(async () => done()),
  };
  const storage = storageStub();
  const view = renderWithMessages(
    <BlogEditor
      post={null}
      categories={[
        { id: "c1", name: "Guides", slug: "guides" },
        { id: "c2", name: "News (hidden)", slug: "news" },
      ]}
      actions={actions}
      storage={storage}
      {...extra}
    />,
  );
  return { actions, storage, ...view };
}

function fill() {
  fireEvent.change(screen.getByLabelText(words.form.title), { target: { value: "Stamp duty" } });
  fireEvent.change(screen.getByLabelText(words.form.author), { target: { value: "Asha Rao" } });
}

/** Gives the hidden file input a file, as the chooser would. */
function choose(container: HTMLElement, file: File) {
  const input = container.querySelector("input[type=file]") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

/** A chosen picture is read before it is kept, so the page takes it a moment after the choice. */
const kept = () => waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());

const PNG = () => pictureFile("image/png", 8, "house.png");

describe("BlogEditor (ADR-143, ADR-144): the article page", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("is titled for a new article, says it is saved as a draft, and links back to the list", () => {
    editor();
    expect(screen.getByRole("heading", { level: 1, name: words.newTitle })).toBeInTheDocument();
    expect(screen.getByText(words.saveNote.new)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.back })).toHaveAttribute("href", "/admin/blog");
  });

  it("makes the article first, then saves the rest on its id, and opens it at its own address", async () => {
    const { actions } = editor({ initialCategory: "c1" });
    fill();
    fireEvent.change(screen.getByLabelText(words.form.excerpt), { target: { value: "Sum." } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(actions.create).toHaveBeenCalledWith({
      title: "Stamp duty",
      authorName: "Asha Rao",
      categoryId: "c1",
    });
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({ postId: POST_ID, slug: "made-slug", excerpt: "Sum." }),
    );
    await waitFor(() => expect(notice.success).toHaveBeenCalledWith(words.toast.created));
    expect(navigation.replace).toHaveBeenCalledWith(`/admin/blog/${POST_ID}`);
  });

  it("edits a stored article: the boxes are filled, saving updates by id and stays on the page, read again", async () => {
    const { actions } = editor({ post: STORED });
    expect(screen.getByRole("heading", { level: 1, name: words.editTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(words.form.title)).toHaveValue("Stamp duty");
    expect(screen.getByLabelText(words.form.slug)).toHaveValue("stamp-duty");
    expect(screen.getByText(words.form.slugLive)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    expect(actions.create).not.toHaveBeenCalled();
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: POST_ID,
        title: "Stamp duty",
        body: [{ type: "paragraph", text: "Stored words." }],
      }),
    );
    // The stored cover is unchanged, so its own action is not called.
    expect(actions.setCover).not.toHaveBeenCalled();
    await waitFor(() => expect(notice.success).toHaveBeenCalledWith(words.toast.saved));
    expect(navigation.refresh).toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("makes the address from the title on request", () => {
    editor();
    fireEvent.change(screen.getByLabelText(words.form.title), {
      target: { value: "What You Pay: Stamp Duty!" },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.slugSuggest }));
    expect(screen.getByLabelText(words.form.slug)).toHaveValue("what-you-pay-stamp-duty");
  });

  it("puts each refused value on its box and keeps what was typed and the page", async () => {
    const { actions } = editor({ post: STORED });
    vi.mocked(actions.update).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        title: [{ key: "validation.required" }],
        slug: [{ key: "validation.blogSlugTaken" }],
      },
    });
    fireEvent.change(screen.getByLabelText(words.form.title), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(screen.getByLabelText(words.form.title)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByText(en.validation.blogSlugTaken)).toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(notice.success).not.toHaveBeenCalled();
  });

  it("puts a refused block's problem on that block", async () => {
    const { actions } = editor({ post: STORED });
    vi.mocked(actions.update).mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "body.0.text": [{ key: "validation.required" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Block 1: Paragraph" })).toHaveTextContent(
        en.validation.required,
      ),
    );
  });

  it("says a failure with no box in a toast, and says an article that is gone is gone", async () => {
    const { actions } = editor({ post: STORED });
    vi.mocked(actions.update).mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(words.gone));
    vi.mocked(actions.update).mockResolvedValue(FAILED);
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(en.errors.INTERNAL));
  });

  it("goes back to the list on Cancel without saving", () => {
    const { actions } = editor({ post: STORED });
    fireEvent.click(screen.getByRole("button", { name: words.form.cancel }));
    expect(navigation.push).toHaveBeenCalledWith("/admin/blog");
    expect(actions.update).not.toHaveBeenCalled();
  });

  it("refuses a picture of the wrong kind at once, without sending anything", async () => {
    const { container, storage } = editor({ post: STORED });
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.replace }));
    choose(container, new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    await waitFor(() => expect(notice.error).toHaveBeenLastCalledWith(en.validation.blogImageType));
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.replace }));
    choose(container, new File(["<svg/>"], "x.png", { type: "image/png" }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledTimes(2));
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("offers to lower the quality of a picture that is still too heavy, and sends nothing", async () => {
    const { container, storage } = editor({ post: STORED });
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.replace }));
    choose(container, pictureFile("image/png", BLOG_IMAGE_MAX_BYTES + 1000, "big.png"));
    expect(await screen.findByText(en.imageReduce.offer.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.imageReduce.reduce })).toBeInTheDocument();
    expect(notice.error).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("takes the hidden data out of a picture that is within the limit before it is kept", async () => {
    const { container, actions, storage } = editor({
      post: { ...STORED, coverPath: null, coverUrl: null, coverAlt: null },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.choose }));
    const clean = PNG();
    const bytes = new Uint8Array(await clean.arrayBuffer());
    // A text chunk (a camera or editor note) between the header and the picture.
    const note = new TextEncoder().encode("tEXtComment GPS-SECRET");
    const chunk = new Uint8Array([0, 0, 0, note.length - 4, ...note, 0, 0, 0, 0]);
    const marked = new File([bytes.slice(0, 33), chunk, bytes.slice(33)], "house.png", {
      type: "image/png",
    });
    choose(container, marked);
    fireEvent.change(await screen.findByLabelText(words.form.cover.alt), {
      target: { value: "A house" },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(actions.setCover).toHaveBeenCalled());
    const sent = vi.mocked(storage.upload).mock.calls[0]?.[1] as File;
    expect(sent.size).toBe(clean.size);
    expect(new TextDecoder().decode(await sent.arrayBuffer())).not.toContain("GPS-SECRET");
  });

  it("holds a chosen cover in the browser until Save, then sends it to the article's folder and sets it with its description", async () => {
    const { container, actions, storage } = editor({
      post: { ...STORED, coverPath: null, coverUrl: null, coverAlt: null },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.choose }));
    choose(container, PNG());
    await kept();
    expect(storage.upload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(words.form.cover.alt), { target: { value: "A house" } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(actions.setCover).toHaveBeenCalled());
    expect(storage.uploaded[0]).toMatch(new RegExp(`^blog/${POST_ID}/[0-9a-f]{16}\\.png$`));
    expect(actions.setCover).toHaveBeenCalledWith({
      postId: POST_ID,
      coverPath: storage.uploaded[0],
      coverAlt: "A house",
    });
  });

  it("asks for the cover's description before sending anything", async () => {
    const { container, actions, storage } = editor({
      post: { ...STORED, coverPath: null, coverUrl: null, coverAlt: null },
    });
    fireEvent.click(screen.getByRole("button", { name: words.form.cover.choose }));
    choose(container, PNG());
    await kept();
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() =>
      expect(screen.getByLabelText(words.form.cover.alt)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(storage.upload).not.toHaveBeenCalled();
    expect(actions.update).not.toHaveBeenCalled();
  });

  it("sends a picture block's file on Save and writes its final path into the body", async () => {
    const { container, actions, storage } = editor({ post: STORED });
    fireEvent.click(screen.getByRole("button", { name: words.editor.add.image }));
    fireEvent.click(screen.getByRole("button", { name: /^Choose picture/ }));
    choose(container, PNG());
    await kept();
    fireEvent.change(screen.getByLabelText(words.editor.imageAlt), { target: { value: "A flat" } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(actions.update).toHaveBeenCalled());
    const path = storage.uploaded[0] as string;
    expect(path).toMatch(new RegExp(`^blog/${POST_ID}/`));
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          { type: "paragraph", text: "Stored words." },
          { type: "image", path, alt: "A flat" },
        ],
      }),
    );
  });

  it("keeps the typed values when a picture cannot be sent, and says so", async () => {
    const { container, actions, storage } = editor({ post: STORED });
    vi.mocked(storage.upload).mockResolvedValue(false);
    fireEvent.click(screen.getByRole("button", { name: words.editor.add.image }));
    fireEvent.click(screen.getByRole("button", { name: /^Choose picture/ }));
    choose(container, PNG());
    await kept();
    fireEvent.change(screen.getByLabelText(words.editor.imageAlt), { target: { value: "A flat" } });
    fireEvent.click(screen.getByRole("button", { name: words.form.save }));
    await waitFor(() => expect(notice.error).toHaveBeenCalledWith(words.uploadFailed));
    expect(actions.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText(words.editor.imageAlt)).toHaveValue("A flat");
  });

  it("previews the article as visitors will see it, from what is typed, and goes back to editing", () => {
    editor({ post: STORED });
    fireEvent.change(screen.getByLabelText(words.form.title), { target: { value: "Typed title" } });
    fireEvent.click(screen.getByRole("button", { name: words.preview.show }));
    expect(screen.getByRole("heading", { level: 2, name: "Typed title" })).toBeInTheDocument();
    expect(screen.getByText("Stored words.")).toBeInTheDocument();
    expect(screen.queryByLabelText(words.form.title)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: words.preview.hide }));
    expect(screen.getByLabelText(words.form.title)).toHaveValue("Typed title");
  });

  it("says there is nothing to preview for an empty new article", () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: words.preview.show }));
    expect(screen.getByText(words.preview.empty)).toBeInTheDocument();
  });
});
