// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PhotoUploader, type PhotoUploaderPhoto } from "../photo-uploader";

const words = messages.domain.photoUploader;

const photo = (
  id: string,
  stage: PhotoUploaderPhoto["stage"],
  extra: Partial<PhotoUploaderPhoto> = {},
): PhotoUploaderPhoto => ({ id, name: `${id}.webp`, stage, ...extra });

const show = (
  photos: PhotoUploaderPhoto[],
  extra: Partial<Parameters<typeof PhotoUploader>[0]> = {},
) => {
  const onFiles = vi.fn();
  const onRemove = vi.fn();
  renderWithMessages(
    <PhotoUploader photos={photos} max={6} onFiles={onFiles} onRemove={onRemove} {...extra} />,
  );
  return { onFiles, onRemove };
};

const chooser = () => screen.getByLabelText(new RegExp(words.title));

describe("PhotoUploader: the photo step (S6-T01, FR-ACC-07)", () => {
  it("starts empty with the drop area, the hint and a count of zero", () => {
    show([]);
    expect(screen.getByText(words.title)).toBeVisible();
    expect(screen.getByText(words.hint)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 6 photos");
    expect(chooser()).toBeEnabled();
  });

  it("takes only JPEG, PNG and WebP from a picker (so a phone converts HEIC first)", () => {
    show([]);
    expect(chooser()).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(chooser()).toHaveAttribute("multiple");
  });

  it("tags only the first saved photo as the cover", () => {
    show([photo("a", "done"), photo("b", "done"), photo("c", "done")]);
    expect(screen.getAllByText(words.cover)).toHaveLength(1);
    const first = screen.getByText("a.webp").closest("li");
    expect(first).not.toBeNull();
    expect(within(first as HTMLElement).getByText(words.cover)).toBeVisible();
  });

  it("gives the cover to the first photo that is saved, not the first in the list", () => {
    show([photo("a", "preparing"), photo("b", "done")]);
    const second = screen.getByText("b.webp").closest("li");
    expect(within(second as HTMLElement).getByText(words.cover)).toBeVisible();
  });

  it("names the step each photo is at, with a bar named by the file", () => {
    show([
      photo("a", "preparing"),
      photo("b", "uploading"),
      photo("c", "saving"),
      photo("d", "removing"),
    ]);
    for (const step of Object.values(words.stage)) expect(screen.getByText(step)).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "a.webp" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "c.webp" })).toBeVisible();
  });

  it("shows no bar on a saved photo", () => {
    show([photo("a", "done")]);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps a refused photo in the list with its reason and does not count it", () => {
    show([photo("a", "done"), photo("b", "error", { error: "This file is not a photo." })]);
    expect(screen.getByText("This file is not a photo.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 6 photos");
  });

  it("turns the drop area off at the maximum, and says six of six", () => {
    show(["a", "b", "c", "d", "e", "f"].map((id) => photo(id, "done")));
    expect(chooser()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("6 of 6 photos");
  });

  it("counts a photo on its way toward the limit", () => {
    show(["a", "b", "c", "d", "e"].map((id) => photo(id, "done")).concat(photo("f", "preparing")));
    expect(chooser()).toBeDisabled();
  });

  it("can be turned off from outside", () => {
    show([], { disabled: true });
    expect(chooser()).toBeDisabled();
  });

  it("hands over the files that were chosen", async () => {
    const { onFiles } = show([]);
    const one = new File(["x"], "hall.jpg", { type: "image/jpeg" });
    const two = new File(["y"], "kitchen.png", { type: "image/png" });
    await userEvent.upload(chooser(), [one, two]);
    expect(onFiles).toHaveBeenCalledWith([one, two]);
  });

  it("names the photo on each remove button and reports which was pressed", async () => {
    const { onRemove } = show([photo("a", "done"), photo("b", "done")]);
    await userEvent.click(screen.getByRole("button", { name: "Remove b.webp" }));
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("shows a notice above the list", () => {
    show([photo("a", "done")], { notice: <p>The session ended.</p> });
    expect(screen.getByText("The session ended.")).toBeVisible();
  });

  it("shows a small picture only for a photo that has one, and hides it from screen readers", () => {
    show([
      photo("a", "done", { previewUrl: "/design-lab/listings/home-a.svg" }),
      photo("b", "done"),
    ]);
    const pictures = document.querySelectorAll("li img");
    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toHaveAttribute("alt", "");
  });
});
