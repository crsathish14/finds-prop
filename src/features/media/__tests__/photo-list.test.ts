import { describe, expect, it } from "vitest";
import {
  coverId,
  isBusy,
  photoListReducer,
  photosInUse,
  progressOf,
  type PhotoItem,
} from "../photo-list";

const item = (
  id: string,
  stage: PhotoItem["stage"],
  extra: Partial<PhotoItem> = {},
): PhotoItem => ({
  id,
  name: `${id}.jpg`,
  stage,
  ...extra,
});

describe("UT-photo-list: what the uploader keeps track of", () => {
  it("walks a photo through its steps and saves it", () => {
    let list: PhotoItem[] = [];
    list = photoListReducer(list, { type: "add", items: [item("a", "preparing")] });
    list = photoListReducer(list, { type: "preview", id: "a", previewUrl: "blob:one" });
    list = photoListReducer(list, { type: "stage", id: "a", stage: "uploading" });
    list = photoListReducer(list, { type: "stage", id: "a", stage: "saving" });
    expect(list[0]).toMatchObject({ stage: "saving", previewUrl: "blob:one" });
    list = photoListReducer(list, { type: "saved", id: "a", photoId: "p-1" });
    expect(list[0]).toMatchObject({ stage: "done", photoId: "p-1" });
  });

  it("keeps a failed photo in the list with its reason, and a new step clears the reason", () => {
    let list = [item("a", "uploading")];
    list = photoListReducer(list, { type: "failed", id: "a", error: "Could not upload" });
    expect(list[0]).toMatchObject({ stage: "error", error: "Could not upload" });
    list = photoListReducer(list, { type: "stage", id: "a", stage: "preparing" });
    expect(list[0]?.error).toBeUndefined();
  });

  it("keeps a photo whose removal failed, saved, with the reason", () => {
    let list = [item("a", "removing", { photoId: "p-1" })];
    list = photoListReducer(list, { type: "kept", id: "a", error: "Could not remove" });
    expect(list[0]).toMatchObject({ stage: "done", error: "Could not remove", photoId: "p-1" });
  });

  it("removes a photo from the list", () => {
    const list = photoListReducer([item("a", "done"), item("b", "done")], {
      type: "removed",
      id: "a",
    });
    expect(list.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("ignores a change to a photo that is no longer there (it was removed on its way)", () => {
    const list = [item("a", "done")];
    expect(photoListReducer(list, { type: "stage", id: "gone", stage: "saving" })).toEqual(list);
    expect(photoListReducer(list, { type: "saved", id: "gone", photoId: "p" })).toEqual(list);
  });

  it("counts every photo that is or will be on the listing, but not a failed one", () => {
    expect(
      photosInUse([
        item("a", "done"),
        item("b", "preparing"),
        item("c", "error"),
        item("d", "removing"),
      ]),
    ).toBe(3);
  });

  it("makes the first saved photo the cover, in list order", () => {
    expect(coverId([item("a", "preparing"), item("b", "done"), item("c", "done")])).toBe("b");
    expect(coverId([item("a", "error"), item("b", "preparing")])).toBeUndefined();
    expect(coverId([item("a", "removing"), item("b", "done")])).toBe("a");
  });

  it("is busy while anything is on its way", () => {
    expect(isBusy([item("a", "done"), item("b", "error")])).toBe(false);
    expect(isBusy([item("a", "done"), item("b", "saving")])).toBe(true);
  });

  it("shows progress by step", () => {
    expect(progressOf("preparing")).toBeLessThan(progressOf("uploading") ?? 0);
    expect(progressOf("uploading")).toBeLessThan(progressOf("saving") ?? 0);
    expect(progressOf("done")).toBeUndefined();
    expect(progressOf("error")).toBeUndefined();
  });
});
