/**
 * The list of photos the uploader shows (S6-T01): what each one is doing and what is left to do. Plain
 * data and a reducer, so the rules (the limit, the cover, what a failure leaves behind) are tested without
 * a screen.
 */
export type PhotoStage = "preparing" | "uploading" | "saving" | "removing" | "done" | "error";

export interface PhotoItem {
  /** The list key: the photo's own id once it is saved, a made-up one before. */
  id: string;
  name: string;
  /** A picture to show: the photo's address when it is saved, or the prepared file in this browser. */
  previewUrl?: string;
  stage: PhotoStage;
  /** Already translated, shown under the name. */
  error?: string;
  /** The saved photo's id (set once the server has recorded it). */
  photoId?: string;
}

export type PhotoListAction =
  | { type: "add"; items: PhotoItem[] }
  | { type: "stage"; id: string; stage: Exclude<PhotoStage, "error" | "done"> }
  | { type: "preview"; id: string; previewUrl: string }
  | { type: "saved"; id: string; photoId: string }
  | { type: "failed"; id: string; error: string }
  | { type: "removed"; id: string }
  /** A removal that did not go through: the photo stays, with the reason. */
  | { type: "kept"; id: string; error: string };

export function photoListReducer(items: PhotoItem[], action: PhotoListAction): PhotoItem[] {
  switch (action.type) {
    case "add":
      return [...items, ...action.items];
    case "stage":
      return items.map((item) =>
        item.id === action.id ? { ...withoutError(item), stage: action.stage } : item,
      );
    case "preview":
      return items.map((item) =>
        item.id === action.id ? { ...item, previewUrl: action.previewUrl } : item,
      );
    case "saved":
      return items.map((item) =>
        item.id === action.id
          ? { ...withoutError(item), stage: "done", photoId: action.photoId }
          : item,
      );
    case "failed":
      return items.map((item) =>
        item.id === action.id ? { ...item, stage: "error", error: action.error } : item,
      );
    case "kept":
      return items.map((item) =>
        item.id === action.id ? { ...item, stage: "done", error: action.error } : item,
      );
    case "removed":
      return items.filter((item) => item.id !== action.id);
  }
}

function withoutError(item: PhotoItem): PhotoItem {
  const rest = { ...item };
  delete rest.error;
  return rest;
}

/** Photos that count toward the limit: everything the listing has or is about to have (a failed one does not). */
export function photosInUse(items: readonly PhotoItem[]): number {
  return items.filter((item) => item.stage !== "error").length;
}

/** The cover is the first photo that is saved, in list order (the database makes the first photo the cover). */
export function coverId(items: readonly PhotoItem[]): string | undefined {
  return items.find((item) => item.stage === "done" || item.stage === "removing")?.id;
}

/** True while the uploader still has work in hand (so a page can warn before leaving). */
export function isBusy(items: readonly PhotoItem[]): boolean {
  return items.some(
    (item) =>
      item.stage === "preparing" ||
      item.stage === "uploading" ||
      item.stage === "saving" ||
      item.stage === "removing",
  );
}

/** How far along a bar should show: steps, not bytes (the browser gives no byte progress for a fetch). */
export function progressOf(stage: PhotoStage): number | undefined {
  switch (stage) {
    case "preparing":
      return 20;
    case "uploading":
      return 55;
    case "saving":
      return 85;
    case "removing":
      return 90;
    default:
      return undefined;
  }
}
