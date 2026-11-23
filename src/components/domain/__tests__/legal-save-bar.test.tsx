// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LegalSaveBar } from "../legal-save-bar";

const WORDS = { discard: "Discard", saveDraft: "Save draft", publish: "Publish", saving: "Saving" };

function bar(props: Partial<React.ComponentProps<typeof LegalSaveBar>> = {}) {
  const onDiscard = vi.fn();
  const onPublish = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <LegalSaveBar
        note="What the buttons do."
        words={WORDS}
        onDiscard={onDiscard}
        onPublish={onPublish}
        {...props}
      />
    </form>,
  );
  return { onDiscard, onPublish, onSubmit };
}

describe("LegalSaveBar (ADR-151, part C)", () => {
  it("shows the note and the three buttons", () => {
    bar();
    expect(screen.getByText("What the buttons do.")).toBeInTheDocument();
    for (const name of ["Discard", "Save draft", "Publish"])
      expect(screen.getByRole("button", { name })).toBeEnabled();
  });

  it("makes Save draft the form's submit and Publish and Discard plain buttons", () => {
    const { onSubmit, onPublish, onDiscard } = bar();
    expect(screen.getByRole("button", { name: "Save draft" })).toHaveAttribute("type", "submit");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("while a draft is saved, the draft button says Saving and Publish and Discard are off", () => {
    bar({ saving: "draft" });
    expect(screen.getByRole("button", { name: "Saving" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("while publishing, Publish says Saving and Save draft is off", () => {
    bar({ saving: "publish" });
    expect(screen.getByRole("button", { name: "Saving" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("turns both saving buttons off when there is nothing to save", () => {
    bar({ disabled: true });
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });
});
