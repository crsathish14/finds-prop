// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pictureFile } from "../../../../tests/image-files";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import { BlogMarkdownFlow, type MarkdownPreview } from "../blog-markdown-flow";
import { BlogMethodChooser } from "../blog-markdown-flow-chooser";

// A stand-in for the browser's own decoding and encoding: a picture "weighs" 100,000 bytes times the quality.
vi.mock("@/lib/image-browser", () => ({
  browserImageDeps: {
    decode: async () => ({ width: 100, height: 100, close: () => undefined }),
    encode: async (_picture: unknown, _size: unknown, type: string, quality: number) =>
      new Blob([new Uint8Array(Math.round(quality * 100_000))], { type }),
  },
}));

const NONE: MarkdownPreview = {
  blocks: [],
  slots: [],
  title: "",
  slug: "",
  excerpt: "",
  warnings: [],
  errors: [],
};

const PICTURE_RULES = {
  accept: "image/png,image/jpeg,image/webp",
  limitBytes: 500 * 1024,
  extension: (file: File) => (file.type === "image/jpeg" ? "jpg" : null),
  maximumKb: 500,
};

/** A stand-in for the converter: the text decides what it answers, so the screen is tested alone. */
const convert = vi.fn(
  (
    text: string,
    pictures: Readonly<Record<string, { path: string; alt: string }>> = {},
  ): MarkdownPreview =>
    text.trim() === ""
      ? NONE
      : text === "PICS"
        ? {
            ...NONE,
            blocks: [
              { type: "paragraph", text: "Before." },
              ...(pictures["IMAGE-1"]
                ? [
                    {
                      type: "image" as const,
                      path: pictures["IMAGE-1"].path,
                      alt: pictures["IMAGE-1"].alt,
                    },
                  ]
                : []),
            ],
            slots: [{ id: "IMAGE-1", alt: "A gate", line: 3 }],
            title: "Pics",
            slug: "pics",
            excerpt: "Before.",
            warnings: pictures["IMAGE-1"] ? [] : [{ code: "imageSlotEmpty", line: 3, count: 1 }],
          }
        : text === "BAD"
          ? {
              ...NONE,
              blocks: [{ type: "paragraph", text: "x" }],
              errors: [{ code: "tooManyBlocks", line: null, count: 120 }],
            }
          : {
              slots: [],
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
      aiPrompt="THE PROMPT TEXT"
      pictureRules={PICTURE_RULES}
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
      pictures: [],
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
    expect(convert).not.toHaveBeenCalledWith("# abc", {});
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(convert).toHaveBeenCalledWith("# abc", {});
    expect(convert.mock.calls.filter(([text]) => text === "# a" || text === "# ab")).toHaveLength(
      0,
    );
  });

  it("copies the AI prompt and shows it on request (ADR-173)", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Copy the AI prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("THE PROMPT TEXT"));
    expect(await screen.findByText(/Copied\. Paste it into your AI tool/)).toBeInTheDocument();
    expect(screen.getByLabelText("The prompt to give to an AI tool")).toHaveTextContent(
      "THE PROMPT TEXT",
    );
  });

  it("tells the admin when the browser would not copy", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.reject(new Error("no")) },
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Copy the AI prompt" }));
    expect(await screen.findByText(/did not copy it/)).toBeInTheDocument();
  });

  it("adds a link to the pasted text with the Add link form (ADR-173)", async () => {
    setup();
    paste("Read the guide.");
    fireEvent.click(screen.getByRole("button", { name: "Add a link to the text" }));
    const group = await screen.findByRole("group", { name: "Add a link" });
    fireEvent.change(within(group).getByLabelText("Words to show"), {
      target: { value: "the guide" },
    });
    fireEvent.change(within(group).getByLabelText("Address"), {
      target: { value: "https://example.com/guide" },
    });
    fireEvent.click(within(group).getByRole("button", { name: "Insert link" }));
    expect(screen.getByLabelText("Markdown text")).toHaveValue(
      "Read the guide.[the guide](https://example.com/guide)",
    );
  });

  it("lists a place for each picture, draws a chosen one in the preview and sends the file (ADR-173)", async () => {
    URL.createObjectURL = vi.fn(() => "blob:chosen");
    const { onCreate } = setup();
    paste("PICS");
    expect(await screen.findByText("IMAGE-1 (line 3)")).toBeInTheDocument();
    expect(screen.getByText(/nothing shows there/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/What IMAGE-1 shows/)).not.toBeInTheDocument();

    const file = pictureFile("image/jpeg", 8, "gate.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Choose a picture for IMAGE-1" }));
    const chooser = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(chooser as HTMLInputElement, { target: { files: [file] } });
    const alt = await screen.findByLabelText("What IMAGE-1 shows");
    expect(alt).toHaveValue("A gate");
    expect(screen.getByText("gate.jpg (1 KB)")).toBeInTheDocument();

    fireEvent.change(alt, { target: { value: "The gate at dusk" } });
    fireEvent.change(field("Author name"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        pictures: [
          { slot: "IMAGE-1", file: expect.any(File), extension: "jpg", alt: "The gate at dusk" },
        ],
      }),
    );
    // The preview was asked for the picture at its place, with the description the admin typed.
    expect(convert).toHaveBeenLastCalledWith("PICS", {
      "IMAGE-1": { path: "slot/IMAGE-1", alt: "The gate at dusk" },
    });
  });

  it("refuses a picture of the wrong kind at once, and one with no description", async () => {
    URL.createObjectURL = vi.fn(() => "blob:chosen");
    const { onCreate } = setup();
    paste("PICS");
    await screen.findByText("IMAGE-1 (line 3)");
    const choose = () =>
      fireEvent.click(screen.getByRole("button", { name: "Choose a picture for IMAGE-1" }));
    const chooser = () => document.querySelector<HTMLInputElement>('input[type="file"]');

    choose();
    fireEvent.change(chooser() as HTMLInputElement, {
      target: { files: [new File(["x"], "x.gif", { type: "image/gif" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WEBP/i);

    // A file that says it is a JPEG but is not one is refused too: only its own bytes count.
    choose();
    fireEvent.change(chooser() as HTMLInputElement, {
      target: { files: [new File(["<svg/>"], "x.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WEBP/i);

    choose();
    fireEvent.change(chooser() as HTMLInputElement, {
      target: { files: [pictureFile("image/jpeg", 8, "ok.jpg")] },
    });
    fireEvent.change(await screen.findByLabelText("What IMAGE-1 shows"), { target: { value: "" } });
    fireEvent.change(field("Author name"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("Say what each chosen picture shows.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("offers to lower the quality of a picture still over the limit, at its own place, and keeps it only once used", async () => {
    URL.createObjectURL = vi.fn(() => "blob:chosen");
    setup();
    paste("PICS");
    await screen.findByText("IMAGE-1 (line 3)");
    fireEvent.click(screen.getByRole("button", { name: "Choose a picture for IMAGE-1" }));
    fireEvent.change(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      {
        target: { files: [pictureFile("image/jpeg", 700 * 1024, "big.jpg")] },
      },
    );
    expect(await screen.findByText(en.imageReduce.offer.title)).toBeInTheDocument();
    expect(screen.queryByLabelText("What IMAGE-1 shows")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.imageReduce.reduce }));
    expect(await screen.findByText(en.imageReduce.ready.title)).toBeInTheDocument();
    expect(screen.queryByLabelText("What IMAGE-1 shows")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.imageReduce.use }));
    expect(await screen.findByLabelText("What IMAGE-1 shows")).toBeInTheDocument();
    expect(screen.queryByText(en.imageReduce.ready.title)).not.toBeInTheDocument();
  });

  it("keeps nothing when the person chooses another file instead", async () => {
    URL.createObjectURL = vi.fn(() => "blob:chosen");
    setup();
    paste("PICS");
    await screen.findByText("IMAGE-1 (line 3)");
    fireEvent.click(screen.getByRole("button", { name: "Choose a picture for IMAGE-1" }));
    fireEvent.change(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      {
        target: { files: [pictureFile("image/jpeg", 700 * 1024, "big.jpg")] },
      },
    );
    fireEvent.click(await screen.findByRole("button", { name: en.imageReduce.chooseAnother }));
    expect(screen.queryByText(en.imageReduce.offer.title)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("What IMAGE-1 shows")).not.toBeInTheDocument();
  });

  it("links back to the choice", () => {
    setup();
    expect(screen.getByRole("link", { name: "Back to the choice" })).toHaveAttribute(
      "href",
      "/admin/blog/new",
    );
  });
});
