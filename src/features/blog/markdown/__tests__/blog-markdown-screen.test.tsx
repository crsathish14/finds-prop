// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../../tests/render-intl";
import type { BlogStorage } from "../../blog-storage";
import { BlogMarkdownScreen, type BlogMarkdownActions } from "../blog-markdown-screen.client";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
const notice = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/notify", () => ({ notify: notice }));

const POST_ID = "00000000-0000-4000-b500-0000000000a1";
const ARTICLE = `# Plots in Chennai

An intro with [a link](https://example.com/guide).

## Steps

- one
- two
`;

const DONE = { postId: POST_ID, slug: "plots-in-chennai", status: "draft" as const, slugs: [] };

function setup(create: BlogMarkdownActions["create"]) {
  renderWithMessages(
    <BlogMarkdownScreen categories={[{ id: "c1", name: "Guides" }]} actions={{ create }} />,
  );
}

async function pasteAndFill() {
  fireEvent.change(screen.getByLabelText("Markdown text"), { target: { value: ARTICLE } });
  await screen.findByRole("heading", { level: 2, name: "Steps" });
  fireEvent.change(screen.getByLabelText("Author name"), { target: { value: "Asha Rao" } });
}

beforeEach(() => vi.clearAllMocks());

describe("BlogMarkdownScreen: the Markdown flow with the real converter (ADR-172)", () => {
  it("draws the converted article and fills the boxes from the pasted text", async () => {
    setup(vi.fn());
    await pasteAndFill();
    expect(screen.getByLabelText("Title")).toHaveValue("Plots in Chennai");
    expect(screen.getByLabelText("Address")).toHaveValue("plots-in-chennai");
    expect(screen.getByLabelText("Summary")).toHaveValue("An intro with a link.");
    // The link is drawn as an anchor by the article's own renderer, not as text.
    expect(screen.getByRole("link", { name: /a link/ })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    expect(screen.getByText("two", { selector: "li" })).toBeInTheDocument();
  });

  it("sends the text and the confirmed boxes to the server action, then opens the draft in the editor", async () => {
    const create = vi.fn(() => Promise.resolve({ ok: true as const, data: DONE }));
    setup(create);
    await pasteAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/admin/blog/${POST_ID}`));
    expect(create).toHaveBeenCalledWith({
      markdown: ARTICLE,
      title: "Plots in Chennai",
      slug: "plots-in-chennai",
      excerpt: "An intro with a link.",
      authorName: "Asha Rao",
      categoryId: null,
    });
    expect(notice.success).toHaveBeenCalledWith("Article created as a draft");
  });

  it("sends no address when the admin cleared it, so the server makes one", async () => {
    const create = vi.fn<BlogMarkdownActions["create"]>(() =>
      Promise.resolve({ ok: true as const, data: DONE }),
    );
    setup(create);
    await pasteAndFill();
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("slug");
  });

  it("shows a refused address under its box, keeps everything typed and does not leave the page", async () => {
    const create = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        code: "VALIDATION" as const,
        fieldErrors: { slug: [{ key: "validation.blogSlugTaken" }] },
      }),
    );
    setup(create);
    await pasteAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(
      await screen.findByText("This address is already used by another article."),
    ).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Markdown text")).toHaveValue(ARTICLE);
    expect(screen.getByLabelText("Author name")).toHaveValue("Asha Rao");
  });

  it("shows the server's own refusal of the text beside the paste box", async () => {
    const create = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        code: "VALIDATION" as const,
        fieldErrors: { markdown: [{ key: "validation.blogMarkdownRefused" }] },
      }),
    );
    setup(create);
    await pasteAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(
      await screen.findByText(/The pasted text cannot be made into an article/),
    ).toBeInTheDocument();
  });

  it("shows a failure with no box to blame as one message", async () => {
    const create = vi.fn(() => Promise.resolve({ ok: false as const, code: "INTERNAL" as const }));
    setup(create);
    await pasteAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});

describe("BlogMarkdownScreen: pictures are sent before the draft is made (ADR-173)", () => {
  const WITH_PICTURES = `# The gate

Before.

![The front gate](IMAGE-1)

![The lobby](IMAGE-2)
`;

  function fakeStorage(uploadResult: (path: string) => boolean = () => true) {
    const uploaded: string[] = [];
    const removed: string[] = [];
    const storage: BlogStorage = {
      upload: (path) => {
        const ok = uploadResult(path);
        if (ok) uploaded.push(path);
        return Promise.resolve(ok);
      },
      remove: (paths) => {
        removed.push(...paths);
        return Promise.resolve();
      },
    };
    return { storage, uploaded, removed };
  }

  async function pasteWithPictures(
    create: BlogMarkdownActions["create"],
    storage: BlogStorage,
    count: number,
  ) {
    URL.createObjectURL = vi.fn(() => "blob:chosen");
    renderWithMessages(
      <BlogMarkdownScreen
        categories={[{ id: "c1", name: "Guides" }]}
        actions={{ create }}
        storage={storage}
      />,
    );
    fireEvent.change(screen.getByLabelText("Markdown text"), {
      target: { value: WITH_PICTURES },
    });
    await screen.findByText("IMAGE-1 (line 5)");
    for (const id of ["IMAGE-1", "IMAGE-2"].slice(0, count)) {
      fireEvent.click(screen.getByRole("button", { name: `Choose a picture for ${id}` }));
      const chooser = document.querySelector<HTMLInputElement>('input[type="file"]');
      fireEvent.change(chooser as HTMLInputElement, {
        target: { files: [new File(["x"], `${id}.png`, { type: "image/png" })] },
      });
      await screen.findByLabelText(`What ${id} shows`);
    }
    fireEvent.change(screen.getByLabelText("Author name"), { target: { value: "Asha Rao" } });
  }

  it("sends each chosen file to a folder named after a new id, then makes the draft with that id", async () => {
    const { storage, uploaded } = fakeStorage();
    const create = vi.fn<BlogMarkdownActions["create"]>(() =>
      Promise.resolve({ ok: true as const, data: DONE }),
    );
    await pasteWithPictures(create, storage, 1);
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/admin/blog/${POST_ID}`));
    const sent = create.mock.calls[0]?.[0];
    expect(sent?.postId).toMatch(/^[0-9a-f-]{36}$/);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatch(new RegExp(`^blog/${sent?.postId}/[a-z0-9]+\\.png$`));
    expect(sent?.pictures).toEqual([{ slot: "IMAGE-1", path: uploaded[0], alt: "The front gate" }]);
  });

  it("sends nothing and takes back what it sent when a file cannot be sent", async () => {
    let count = 0;
    const { storage, removed, uploaded } = fakeStorage(() => ++count === 1);
    const create = vi.fn<BlogMarkdownActions["create"]>();
    await pasteWithPictures(create, storage, 2);
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText(/A picture could not be sent/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(removed).toEqual(uploaded);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("takes the files away again when the server refuses the draft", async () => {
    const { storage, removed, uploaded } = fakeStorage();
    const create = vi.fn<BlogMarkdownActions["create"]>(() =>
      Promise.resolve({
        ok: false as const,
        code: "VALIDATION" as const,
        fieldErrors: { pictures: [{ key: "validation.blogImageSize", values: { maximum: 500 } }] },
      }),
    );
    await pasteWithPictures(create, storage, 1);
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(removed).toEqual(uploaded));
    expect(uploaded).toHaveLength(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/500 KB/, { selector: "[role=alert] *, [role=alert]" }),
    ).toBeInTheDocument();
  });

  it("sends no id and touches no bucket when no picture was chosen", async () => {
    const { storage, uploaded } = fakeStorage();
    const create = vi.fn<BlogMarkdownActions["create"]>(() =>
      Promise.resolve({ ok: true as const, data: DONE }),
    );
    await pasteWithPictures(create, storage, 0);
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("postId");
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("pictures");
    expect(uploaded).toEqual([]);
  });
});
