import {
  EXTENSION_OF,
  readImageInfo,
  slotFit,
  slotProblem,
  type ImageInfo,
  type SlotProblem,
} from "./sponsor-rules";
import {
  SLOT_KEYS,
  slotOf,
  type ChosenDraftPicture,
  type SlotKey,
  type SponsorDraft,
  type StoredDraftPicture,
} from "./sponsor-draft";
import type { SponsorStorage } from "./sponsor-storage";

/**
 * Checking a picture in the browser and putting it in the bucket (S7-T11, FR-ADM-11, DEC-15). The checks are the
 * server's own (`slotProblem`), so the person is told at once, before anything is sent; the server still reads every new
 * file back and decides. A picture is sent only when the sponsor is saved: a drawer that is cancelled leaves nothing in
 * the bucket, and if the save then fails the files that were just sent are taken away again. No framework code, so
 * it is tested on its own.
 */

/** How much of a file is read to find its type and size: far more than any header, far less than a big file. */
const HEADER_BYTES = 512 * 1024;

export type PictureCheck =
  | { ok: true; info: ImageInfo; bytes: number; fit: "cover" | "contain" }
  | { ok: false; problem: SlotProblem; info: ImageInfo | null; bytes: number };

/**
 * Whether a chosen file can go in a slot: a PNG, JPEG or WebP by its own first bytes (a name or a declared type proves
 * nothing), no heavier than the limit, at least twice the slot and close enough to its shape. Reads only the start of
 * the file.
 */
export async function checkPicture(file: File, key: SlotKey): Promise<PictureCheck> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const info = readImageInfo(head);
  const problem = slotProblem(slotOf(key), info, file.size);
  if (problem !== null || !info)
    return { ok: false, problem: problem ?? "type", info, bytes: file.size };
  const fit = slotFit(slotOf(key), info);
  // `slotProblem` has already refused a shape the slot cannot take, so this is cover or contain.
  return { ok: true, info, bytes: file.size, fit: fit === "contain" ? "contain" : "cover" };
}

/** The picture a good check makes (the page gives it the address it made for the preview). */
export function chosenPictureOf(
  file: File,
  check: Extract<PictureCheck, { ok: true }>,
  url: string,
): ChosenDraftPicture {
  return {
    kind: "chosen",
    file,
    url,
    width: check.info.width,
    height: check.info.height,
    bytes: check.bytes,
    type: check.info.type,
    fit: check.fit,
  };
}

/** A short random name for a stored file (letters and digits only, so it always fits the path rule). */
export function randomToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A new sponsor's id: the folder of its pictures is named after it (`sponsors/<id>/`). */
export function newSponsorId(token: () => string = randomToken): string {
  return `sp-${token()}`;
}

export type UploadResult =
  /** Every chosen picture is in the bucket: the draft now holds only stored ones. `uploaded` lists the new files. */
  | { ok: true; draft: SponsorDraft; uploaded: string[] }
  /** One picture could not be sent. `uploaded` lists what already was, for the page to take away again. */
  | { ok: false; slot: SlotKey; uploaded: string[] };

/**
 * Puts the sponsor's chosen pictures in the bucket under `sponsors/<its id>/`, one after another, and gives back the
 * draft with each swapped for a stored picture. It stops at the first one that fails. The address a stored picture is
 * shown from stays the preview address until the page reads the saved sponsors again.
 */
export async function uploadChosen(
  draft: SponsorDraft,
  storage: SponsorStorage,
  token: () => string = randomToken,
): Promise<UploadResult> {
  const uploaded: string[] = [];
  const pictures: SponsorDraft["pictures"] = { ...draft.pictures };
  for (const key of SLOT_KEYS) {
    const picture = draft.pictures[key];
    if (picture?.kind !== "chosen") continue;
    const path = `sponsors/${draft.id}/${token()}.${EXTENSION_OF[picture.type]}`;
    if (!(await storage.upload(path, picture.file))) return { ok: false, slot: key, uploaded };
    uploaded.push(path);
    const stored: StoredDraftPicture = {
      kind: "stored",
      path,
      url: picture.url,
      width: picture.width,
      height: picture.height,
      bytes: picture.bytes,
      type: picture.type,
    };
    pictures[key] = stored;
  }
  return { ok: true, draft: { ...draft, pictures }, uploaded };
}
