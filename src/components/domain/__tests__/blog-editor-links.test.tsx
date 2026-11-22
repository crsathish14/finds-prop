// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { BlogBlockEditor } from "../blog-block-editor";
import type { BlogBlock } from "../blog-blocks";

const BLOCKS: BlogBlock[] = [
  { type: "heading", level: 2, text: "Section" },
  { type: "paragraph", text: "Some words." },
  { type: "list", ordered: false, items: ["One", "Two"] },
  { type: "quote", text: "Quoted.", cite: "Someone" },
];

function setup(blocks: BlogBlock[] = BLOCKS, disabled = false) {
  const onChange = vi.fn();
  renderWithMessages(
    <BlogBlockEditor
      blocks={blocks}
      onChange={onChange}
      imageUrl={(path) => `/pictures/${path}.svg`}
      onChooseImage={vi.fn()}
      disabled={disabled}
    />,
  );
  return { onChange };
}

const openForm = (place: number) =>
  fireEvent.click(screen.getByRole("button", { name: `Add a link to block ${place}` }));

describe("BlogBlockEditor: adding a link (ADR-169)", () => {
  it("puts the finished link into the text where the cursor was", () => {
    const { onChange } = setup();
    const box = screen.getByDisplayValue("Some words.") as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(4, 4);
    openForm(2);
    const form = screen.getByRole("group", { name: "New link for block 2" });
    fireEvent.change(within(form).getByLabelText("Words to show"), { target: { value: "Home" } });
    fireEvent.change(within(form).getByLabelText("Address"), { target: { value: "/properties" } });
    fireEvent.click(within(form).getByRole("button", { name: "Insert link" }));
    expect(onChange.mock.calls[0]?.[0][1]).toEqual({
      type: "paragraph",
      text: "Some[Home](/properties) words.",
    });
    expect(screen.queryByRole("group", { name: "New link for block 2" })).not.toBeInTheDocument();
  });

  it("uses the selected words as the link's words and replaces them", () => {
    const { onChange } = setup();
    const box = screen.getByDisplayValue("Some words.") as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(5, 10);
    openForm(2);
    const form = screen.getByRole("group", { name: "New link for block 2" });
    expect(within(form).getByLabelText("Words to show")).toHaveValue("words");
    fireEvent.change(within(form).getByLabelText("Address"), {
      target: { value: "https://example.com/a" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Insert link" }));
    expect(onChange.mock.calls[0]?.[0][1]).toEqual({
      type: "paragraph",
      text: "Some [words](https://example.com/a).",
    });
  });

  it("works in a list and in a quote too", () => {
    const { onChange } = setup();
    openForm(3);
    fireEvent.change(screen.getByLabelText("Words to show"), { target: { value: "More" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "/blog" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert link" }));
    expect((onChange.mock.calls[0]?.[0][2] as { items: string[] }).items.join("\n")).toContain(
      "[More](/blog)",
    );
    openForm(4);
    fireEvent.change(screen.getByLabelText("Words to show"), { target: { value: "Blog" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "/blog" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert link" }));
    expect(onChange.mock.calls[1]?.[0][3]).toMatchObject({ text: "Quoted.[Blog](/blog)" });
  });

  it("refuses an address that is not allowed, says why, and keeps the form open", () => {
    const { onChange } = setup();
    openForm(2);
    fireEvent.change(screen.getByLabelText("Words to show"), { target: { value: "Bad" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "http://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert link" }));
    expect(screen.getByText(/starts with https:\/\//)).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Words to show"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert link" }));
    expect(screen.getByText(/1 to 160 characters/)).toBeInTheDocument();
    expect(screen.getByLabelText("Words to show")).toHaveAttribute("aria-invalid", "true");
  });

  it("adds the link on Enter instead of saving the article, and closes on Escape", () => {
    const { onChange } = setup();
    openForm(2);
    fireEvent.change(screen.getByLabelText("Words to show"), { target: { value: "Home" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "/" } });
    fireEvent.keyDown(screen.getByLabelText("Address"), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    openForm(2);
    fireEvent.keyDown(screen.getByLabelText("Words to show"), { key: "Escape" });
    expect(screen.queryByRole("group", { name: "New link for block 2" })).not.toBeInTheDocument();
  });

  it("tells assistive technology whether the form is open", () => {
    setup();
    const button = screen.getByRole("button", { name: "Add a link to block 2" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("turns the Add link buttons off while saving", () => {
    setup(BLOCKS, true);
    expect(screen.getByRole("button", { name: "Add a link to block 2" })).toBeDisabled();
  });

  it("says on a heading that the article's title is the page's main heading", () => {
    setup();
    expect(screen.getByText(/title is already the main heading/)).toBeInTheDocument();
  });
});
