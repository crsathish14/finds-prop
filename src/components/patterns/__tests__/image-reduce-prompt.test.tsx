// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImageReducePrompt, type ImageReducePromptWords } from "../image-reduce-prompt";

const words: ImageReducePromptWords = {
  reduce: "Reduce quality",
  use: "Use this picture",
  chooseAnother: "Choose another",
};
const copy = { title: "A title", text: "Some words about the sizes" };
const picture = { url: "/design-lab/listings/home-a.svg", alt: "The lowered picture" };

const buttons = () => screen.queryAllByRole("button").map((button) => button.textContent);

describe("UT-image-reduce-prompt: offer", () => {
  it("asks, with Reduce quality and Choose another", async () => {
    const onReduce = vi.fn();
    const onChooseAnother = vi.fn();
    render(
      <ImageReducePrompt
        state="offer"
        {...copy}
        words={words}
        onReduce={onReduce}
        onChooseAnother={onChooseAnother}
      />,
    );
    expect(screen.getByText("A title")).toBeInTheDocument();
    expect(screen.getByText("Some words about the sizes")).toBeInTheDocument();
    expect(buttons()).toEqual(["Reduce quality", "Choose another"]);
    await userEvent.click(screen.getByRole("button", { name: "Reduce quality" }));
    expect(onReduce).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("is read politely and is not busy", () => {
    render(<ImageReducePrompt state="offer" {...copy} words={words} />);
    const box = screen.getByRole("status");
    expect(box).not.toHaveAttribute("aria-busy");
  });
});

describe("UT-image-reduce-prompt: working", () => {
  it("shows no buttons and marks the box busy", () => {
    render(<ImageReducePrompt state="working" {...copy} words={words} />);
    expect(buttons()).toEqual([]);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});

describe("UT-image-reduce-prompt: ready", () => {
  it("shows the result and asks: Use this picture or Choose another", async () => {
    const onUse = vi.fn();
    const onChooseAnother = vi.fn();
    render(
      <ImageReducePrompt
        state="ready"
        {...copy}
        words={words}
        preview={picture}
        onUse={onUse}
        onChooseAnother={onChooseAnother}
      />,
    );
    expect(screen.getByRole("img", { name: "The lowered picture" })).toBeInTheDocument();
    expect(buttons()).toEqual(["Use this picture", "Choose another"]);
    await userEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(onUse).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("shows no picture in the other states", () => {
    render(<ImageReducePrompt state="offer" {...copy} words={words} preview={picture} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("UT-image-reduce-prompt: failed", () => {
  it("is read at once and asks only for another file", async () => {
    const onChooseAnother = vi.fn();
    render(
      <ImageReducePrompt
        state="failed"
        {...copy}
        words={words}
        onChooseAnother={onChooseAnother}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(buttons()).toEqual(["Choose another"]);
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });
});

describe("UT-image-reduce-prompt: focus", () => {
  it("can be given focus by the page that shows it", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ImageReducePrompt state="offer" {...copy} words={words} ref={ref} />);
    ref.current?.focus();
    expect(ref.current).toBe(document.activeElement);
  });
});
