// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ImagePrompt } from "@/lib/use-image-reduce";
import { ImageReduceFlow } from "../image-reduce-flow";

const words = en.imageReduce;
const base = { fileName: "front.jpg", bytes: 2.3 * 1024 * 1024, limitBytes: 500 * 1024 };

function show(prompt: ImagePrompt | null) {
  const handlers = { onReduce: vi.fn(), onUse: vi.fn(), onChooseAnother: vi.fn() };
  renderWithMessages(<ImageReduceFlow prompt={prompt} {...handlers} />);
  return handlers;
}

describe("UT-image-reduce-flow: the words and sizes", () => {
  it("draws nothing when there is no prompt", () => {
    show(null);
    expect(document.querySelector('[data-slot="image-reduce-prompt"]')).toBeNull();
  });

  it("asks, with the picture's weight and the limit written the same way everywhere", () => {
    const handlers = show({ state: "offer", ...base });
    expect(screen.getByText(words.offer.title)).toBeVisible();
    expect(
      screen.getByText(
        "The hidden data is already removed, but it is 2.3 MB and the limit is 500 KB. Lower its quality to fit?",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: words.reduce }));
    expect(handlers.onReduce).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: words.chooseAnother }));
    expect(handlers.onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("shows the work", () => {
    show({ state: "working", ...base });
    expect(screen.getByText(words.working.title)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the result with the new and the old weight, and the picture", () => {
    const handlers = show({
      state: "ready",
      ...base,
      reducedBytes: 430 * 1024,
      previewUrl: "/design-lab/listings/home-a.svg",
    });
    expect(screen.getByText(/Now 430 KB, down from 2.3 MB/)).toBeVisible();
    expect(screen.getByRole("img", { name: words.previewAlt })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: words.use }));
    expect(handlers.onUse).toHaveBeenCalledTimes(1);
  });

  it("says how heavy the picture is at the lowest quality when that is still too heavy", () => {
    show({ state: "failed", reason: "cannot_fit", smallestBytes: 620 * 1024, ...base });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Even at the lowest quality we allow it is 620 KB, and the limit is 500 KB.",
    );
  });

  it("says when the browser cannot make this kind of picture, and when it failed another way", () => {
    show({ state: "failed", reason: "no_encoder", smallestBytes: null, ...base });
    expect(screen.getByText(words.failed.noEncoder.title)).toBeVisible();
  });

  it("has a plain message for any other failure", () => {
    show({ state: "failed", reason: "other", smallestBytes: null, ...base });
    expect(screen.getByText(words.failed.other.title)).toBeVisible();
    expect(screen.getByRole("button", { name: words.chooseAnother })).toBeVisible();
  });

  it("moves focus to the prompt when it appears", () => {
    show({ state: "offer", ...base });
    expect(document.activeElement).toBe(
      document.querySelector('[data-slot="image-reduce-prompt"]'),
    );
  });
});
