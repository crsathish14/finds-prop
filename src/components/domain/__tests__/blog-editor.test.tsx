// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogBlockEditor, emptyBlock } from "../blog-block-editor";
import type { BlogBlock } from "../blog-blocks";

const imageUrl = (path: string) => `/pictures/${path}.svg`;

const BLOCKS: BlogBlock[] = [
  { type: "heading", level: 2, text: "Section" },
  { type: "paragraph", text: "Some words." },
  { type: "list", ordered: false, items: ["One", "Two"] },
  { type: "quote", text: "Quoted.", cite: "Someone" },
  { type: "image", path: "home-a", alt: "A flat", caption: "Caption" },
];

function setup(
  blocks: BlogBlock[] = BLOCKS,
  props: Partial<Parameters<typeof BlogBlockEditor>[0]> = {},
) {
  const onChange = vi.fn();
  const onChooseImage = vi.fn();
  renderWithMessages(
    <BlogBlockEditor
      blocks={blocks}
      onChange={onChange}
      imageUrl={imageUrl}
      onChooseImage={onChooseImage}
      {...props}
    />,
  );
  return { onChange, onChooseImage };
}

describe("BlogBlockEditor: writing the body of an article (ADR-144)", () => {
  it("names each block by its place and kind, and every button by the block it acts on", () => {
    setup();
    expect(screen.getByRole("group", { name: "Block 3: List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move block 3 up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete block 3" })).toBeEnabled();
  });

  it("turns off Move up on the first block and Move down on the last", () => {
    setup();
    expect(screen.getByRole("button", { name: "Move block 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move block 5 down" })).toBeDisabled();
  });

  it("moves a block up and down by swapping it with its neighbour", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Move block 2 up" }));
    expect((onChange.mock.calls[0]?.[0] as BlogBlock[]).map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "list",
      "quote",
      "image",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Move block 4 down" }));
    expect((onChange.mock.calls[1]?.[0] as BlogBlock[]).map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "image",
      "quote",
    ]);
  });

  it("deletes a block and keeps the others in order", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete block 2" }));
    expect((onChange.mock.calls[0]?.[0] as BlogBlock[]).map((block) => block.type)).toEqual([
      "heading",
      "list",
      "quote",
      "image",
    ]);
  });

  it("adds a block of each kind at the end, starting empty", () => {
    const { onChange } = setup([]);
    const kinds = ["heading", "paragraph", "list", "quote", "image"] as const;
    const labels = ["Add heading", "Add paragraph", "Add list", "Add quote", "Add picture"];
    labels.forEach((label, index) => {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(onChange).toHaveBeenLastCalledWith([emptyBlock(kinds[index] as BlogBlock["type"])]);
    });
    expect(emptyBlock("heading")).toEqual({ type: "heading", level: 2, text: "" });
    expect(emptyBlock("image")).toEqual({ type: "image", path: "", alt: "" });
  });

  it("says there is no text yet when the body is empty", () => {
    setup([]);
    expect(screen.getByText(/no text yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("writes into a paragraph, a heading and a quote's credit", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByDisplayValue("Some words."), { target: { value: "New words." } });
    expect(onChange.mock.calls[0]?.[0][1]).toEqual({ type: "paragraph", text: "New words." });
    fireEvent.change(screen.getByDisplayValue("Section"), { target: { value: "Renamed" } });
    expect(onChange.mock.calls[1]?.[0][0]).toEqual({ type: "heading", level: 2, text: "Renamed" });
    fireEvent.change(screen.getByDisplayValue("Someone"), { target: { value: "Someone else" } });
    expect(onChange.mock.calls[2]?.[0][3]).toEqual({
      type: "quote",
      text: "Quoted.",
      cite: "Someone else",
    });
  });

  it("changes a heading's size and a list's style, and takes a list a line to an item", () => {
    const { onChange } = setup();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Heading size of block 1" })).getByRole(
        "radio",
        {
          name: "Sub-heading",
        },
      ),
    );
    expect(onChange.mock.calls[0]?.[0][0]).toMatchObject({ type: "heading", level: 3 });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "List style of block 3" })).getByRole("radio", {
        name: "Numbers",
      }),
    );
    expect(onChange.mock.calls[1]?.[0][2]).toMatchObject({ type: "list", ordered: true });
    fireEvent.change(screen.getByDisplayValue(/One/), { target: { value: "One\nTwo\nThree" } });
    expect(onChange.mock.calls[2]?.[0][2]).toMatchObject({ items: ["One", "Two", "Three"] });
  });

  it("asks the page to choose a picture, and needs the description", () => {
    const { onChooseImage, onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Replace picture" }));
    expect(onChooseImage).toHaveBeenCalledWith(4);
    fireEvent.change(screen.getByDisplayValue("A flat"), { target: { value: "A bright flat" } });
    expect(onChange.mock.calls[0]?.[0][4]).toMatchObject({ alt: "A bright flat" });
    expect(screen.getByText("Describe the picture")).toBeInTheDocument();
  });

  it("offers Choose picture for a picture block that has none yet", () => {
    setup([{ type: "image", path: "", alt: "" }]);
    expect(screen.getByRole("button", { name: "Choose picture" })).toBeInTheDocument();
  });

  it("ties a block's problem to its box, and counts the blocks used", () => {
    setup(BLOCKS, { errors: { 1: "Write some text or delete this block." } });
    expect(screen.getByText("Write some text or delete this block.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Some words.")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("5 of 100 blocks used.")).toBeInTheDocument();
  });

  it("turns the Add buttons off when the article is full, and says why", () => {
    setup(BLOCKS.slice(0, 2), { max: 2 });
    expect(screen.getByRole("button", { name: "Add paragraph" })).toBeDisabled();
    expect(screen.getByText(/used all 2 blocks/)).toBeInTheDocument();
  });

  it("turns everything off while saving", () => {
    setup(BLOCKS.slice(0, 2), { disabled: true });
    expect(screen.getByRole("button", { name: "Add heading" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete block 1" })).toBeDisabled();
    expect(screen.getByDisplayValue("Some words.")).toBeDisabled();
  });
});
