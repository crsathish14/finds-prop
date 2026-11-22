// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogMarkdownFlow, type MarkdownPreview } from "../blog-markdown-flow";
import { BlogMethodChooser } from "../blog-markdown-flow-chooser";

const NONE: MarkdownPreview = {
  blocks: [],
  title: "",
  slug: "",
  excerpt: "",
  warnings: [],
  errors: [],
};

/** A stand-in for the converter: the text decides what it answers, so the screen is tested alone. */
const convert = vi.fn((text: string): MarkdownPreview =>
  text.trim() === ""
    ? NONE
    : text === "BAD"
      ? {
          ...NONE,
          blocks: [{ type: "paragraph", text: "x" }],
          errors: [{ code: "tooManyBlocks", line: null, count: 120 }],
        }
      : {
          blocks: [
            { type: "heading", level: 2, text: "A heading" },
            { type: "paragraph", text: "Body words." },
          ],
          title: "Made title",
          slug: "made-title",
          excerpt: "Body words.",
          warnings: [
            { code: "table", line: 4 },
            { code: "formatting", line: null, count: 3 },
            { code: "split", line: 2, detail: "list", count: 2 },
          ],
          errors: [],
        },
);

const CATEGORIES = [
  { id: "c1", name: "Guides" },
  { id: "c2", name: "News" },
];

function setup(
  options: {
    onCreate?: (
      input: unknown,
    ) => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>;
    debounceMs?: number;
    initialCategory?: string;
  } = {},
) {
  const onCreate = vi.fn(options.onCreate ?? (() => Promise.resolve({ ok: true as const })));
  renderWithMessages(
    <BlogMarkdownFlow
      categories={CATEGORIES}
      initialCategory={options.initialCategory ?? ""}
      convert={convert}
      onCreate={onCreate}
      backHref="/admin/blog/new"
      debounceMs={options.debounceMs ?? 0}
    />,
  );
  return { onCreate };
}

const paste = (text: string) =>
  fireEvent.change(screen.getByLabelText("Markdown text"), { target: { value: text } });
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

afterEach(() => {
  vi.useRealTimers();
  convert.mockClear();
});

describe("BlogMethodChooser (ADR-172)", () => {
  it("offers the block editor and Markdown as two named cards with their own links", () => {
    renderWithMessages(
      <BlogMethodChooser
        blocksHref="/admin/blog/new?method=blocks"
        markdownHref="/admin/blog/new?method=markdown"
      />,
    );
    const blocks = screen.getByRole("region", { name: "Block editor" });
    expect(within(blocks).getByRole("link", { name: "Open the block editor" })).toHaveAttribute(
      "href",
      "/admin/blog/new?method=blocks",
    );
    const markdown = screen.getByRole("region", { name: "Paste Markdown" });
    expect(within(markdown).getByRole("link", { name: "Paste Markdown" })).toHaveAttribute(
      "href",
      "/admin/blog/new?method=markdown",
    );
  });
});

describe("BlogMarkdownFlow: the paste screen (ADR-172)", () => {
  it("starts with a gentle empty state and no changes listed", () => {
    setup();
    expect(screen.getByText("Paste your article to see it here.")).toBeInTheDocument();
    expect(screen.queryByText(/changes? (was|were) made/)).not.toBeInTheDocument();
    expect(screen.getByText("What is kept")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "New article from Markdown" }),
    ).toBeInTheDocument();
  });

  it("treats blank text as empty", () => {
    setup();
    paste("   \n  ");
    expect(screen.getByText("Paste your article to see it here.")).toBeInTheDocument();
  });

  it("draws the preview with the article's own blocks and fills the title, address and summary", async () => {
    setup();
    paste("# whatever");
    expect(await screen.findByRole("heading", { level: 2, name: "A heading" })).toBeInTheDocument();
    expect(screen.getAllByText("Body words.", { selector: "p" })).toHaveLength(2);
    expect(field("Title")).toHaveValue("Made title");
    expect(field("Address")).toHaveValue("made-title");
    expect(screen.getByLabelText("Summary")).toHaveValue("Body words.");
    expect(screen.getByRole("heading", { level: 2, name: "Made title" })).toBeInTheDocument();
  });

  it("keeps what the admin typed in a filled box when the text changes", async () => {
    setup();
    paste("# one");
    await screen.findByRole("heading", { name: "A heading" });
    fireEvent.change(field("Title"), { target: { value: "My own title" } });
    paste("# two");
    expect(field("Title")).toHaveValue("My own title");
    expect(field("Address")).toHaveValue("made-title");
  });

  it("lists every change with its line, once each, in plain words", async () => {
    setup();
    paste("# whatever");
    expect(await screen.findByText("3 changes were made")).toBeInTheDocument();
    expect(screen.getByText(/Line 4: a table became plain paragraphs/)).toBeInTheDocument();
    expect(screen.getByText(/removed in 3 places/)).toBeInTheDocument();
    expect(
      screen.getByText(/Line 2: a list of more than 50 items was split into 2 lists/),
    ).toBeInTheDocument();
  });

  it("shows problems that stop the draft, and turns Create draft off", async () => {
    setup();
    paste("BAD");
    expect(
      await screen.findByText("These must be fixed before a draft can be made"),
    ).toBeInTheDocument();
    expect(screen.getByText(/makes 120 blocks/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
  });

  it("asks for the text, the title and the author before it asks the server", async () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(
      await screen.findByText(/Paste some text that makes at least one block/),
    ).toBeInTheDocument();
    paste("# text");
    await screen.findByRole("heading", { name: "A heading" });
    fireEvent.change(field("Title"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect((await screen.findAllByText("This field is required.")).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("sends what was confirmed beside the preview, with no author guessed", async () => {
    const { onCreate } = setup({ initialCategory: "c2" });
    paste("# text");
    await screen.findByRole("heading", { name: "A heading" });
    fireEvent.change(field("Author name"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      markdown: "# text",
      title: "Made title",
      slug: "made-title",
      excerpt: "Body words.",
      authorName: "Asha Rao",
      categoryId: "c2",
    });
  });

  it("says it is working while it saves and turns the boxes off", async () => {
    let finish: (value: { ok: true }) => void = () => undefined;
    const { onCreate } = setup({
      onCreate: () => new Promise((resolve) => (finish = resolve as typeof finish)),
    });
    paste("# text");
    await screen.findByRole("heading", { name: "A heading" });
    fireEvent.change(field("Author name"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByRole("button", { name: "Creating the draft…" })).toBeDisabled();
    expect(field("Title")).toBeDisabled();
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true }));
    expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
  });

  it("puts a refused save's problems on their boxes and moves focus to the first", async () => {
    setup({
      onCreate: () =>
        Promise.resolve({
          ok: false as const,
          errors: { slug: "This address is already used.", authorName: "Too short." },
        }),
    });
    paste("# text");
    await screen.findByRole("heading", { name: "A heading" });
    fireEvent.change(field("Author name"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("This address is already used.")).toBeInTheDocument();
    expect(field("Address")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(field("Address")).toHaveFocus());
    expect(field("Title")).toHaveValue("Made title");
  });

  it("waits until typing stops before it converts", () => {
    vi.useFakeTimers();
    setup({ debounceMs: 250 });
    convert.mockClear();
    paste("# a");
    paste("# ab");
    paste("# abc");
    expect(convert).not.toHaveBeenCalledWith("# abc");
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(convert).toHaveBeenCalledWith("# abc");
    expect(convert.mock.calls.filter(([text]) => text === "# a" || text === "# ab")).toHaveLength(
      0,
    );
  });

  it("links back to the choice", () => {
    setup();
    expect(screen.getByRole("link", { name: "Back to the choice" })).toHaveAttribute(
      "href",
      "/admin/blog/new",
    );
  });
});
