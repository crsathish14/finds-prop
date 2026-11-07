import { ActionError } from "@/server/actions/normalise-error";
import {
  EDITABLE_STATUSES,
  PHOTO_EXTENSIONS,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  PHOTO_MAX_EDGE,
  PHOTO_MAX_MEGABYTES,
  PHOTO_MIN_EDGE,
  type PhotoMime,
} from "./constants";
import { inspectImage, type ImageProblem } from "./inspect-image";
import type { FinalizePhotoInput, RemovePhotoInput, RequestPhotoUploadInput } from "./schemas";

/**
 * The rules of the listing photo pipeline (S6-T01, ADR-015, plan 07 section 7), apart from the code that
 * reaches the database and the storage service so they can be tested with a stand-in. The real stores are
 * in `service.ts`. The order is the one the plan asks for: authorise first (the listing is the caller's and
 * still open, the count is below the limit), then issue an address; and on the way back, read the stored
 * file itself, never trust what the browser said about it.
 */

/** The caller's own listing, as the rules need it. */
export interface OwnListing {
  id: string;
  shortId: string;
  status: string;
}

/** Reads and writes made as the signed-in caller, under Row Level Security. */
export interface PhotoCallerStore {
  /** The listing if it is the caller's, else null (a stranger's listing looks the same as a missing one). */
  readOwnListing(listingId: string): Promise<OwnListing | null>;
  countPhotos(listingId: string): Promise<number>;
  /** A one-time address and token to upload one file to `path` (the bucket's own rules still apply). */
  createSignedUpload(path: string): Promise<{ token: string }>;
  /** Removes the row if the caller may; true when a row went. */
  deletePhotoRow(listingId: string, photoId: string): Promise<{ storagePath: string } | null>;
}

/** Reads and writes made with the service role, after the caller was checked. */
export interface PhotoServerStore {
  /** The stored file, or null when there is none. */
  download(path: string): Promise<Uint8Array | null>;
  deleteObject(path: string): Promise<void>;
  /** Calls `finalize_listing_media`; returns the new photo's id. Throws an `ActionError` on a refusal. */
  finalize(row: {
    ownerId: string;
    listingId: string;
    path: string;
    mime: PhotoMime;
    bytes: number;
    width: number;
    height: number;
  }): Promise<string>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function isEditable(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

const fail = (key: string, values?: Record<string, string | number>) =>
  new ActionError("VALIDATION", "The photo was refused", {
    fieldErrors: { photo: [values ? { key, values } : { key }] },
  });

const tooLarge = () => fail("validation.photoTooLarge", { maximum: PHOTO_MAX_MEGABYTES });
const limitReached = () => fail("validation.photoLimit", { maximum: PHOTO_MAX_COUNT });

/**
 * Turns what the storage service and `finalize_listing_media` raise into the closed set of action errors.
 * A listing that is not the caller's, or a file that is not there, is "not found"; a sold or rented home is
 * forbidden; the seventh photo is the limit message; a path that does not fit is a validation problem.
 */
export function mapMediaWriteError(failure: DatabaseFailure): ActionError {
  if (failure.message === "listing_media.limit") {
    return limitReached();
  }
  if (failure.code === "P0002") {
    return new ActionError("NOT_FOUND", "The listing or the file was not found");
  }
  if (failure.code === "42501") {
    return new ActionError("FORBIDDEN", "The listing no longer takes photos");
  }
  if (failure.code === "22023") {
    return new ActionError("VALIDATION", "The photo path does not fit", {
      fieldErrors: { photo: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The photo write failed");
}

/** Removes a refused file. If that fails the sweeper removes it within a day, so it must not hide the real answer. */
async function discard(store: Pick<PhotoServerStore, "deleteObject">, path: string): Promise<void> {
  try {
    await store.deleteObject(path);
  } catch {
    // Left for the sweeper.
  }
}

async function ownEditableListing(store: PhotoCallerStore, listingId: string): Promise<OwnListing> {
  const listing = await store.readOwnListing(listingId);
  if (!listing) throw new ActionError("NOT_FOUND", "The listing was not found");
  if (!isEditable(listing.status)) {
    throw new ActionError("FORBIDDEN", "The listing no longer takes photos");
  }
  return listing;
}

/**
 * Step 1 of an upload: the caller owns the listing, it is still open, the photo count has room and the file
 * size fits. Then the server names the file (`<owner>/<listing>/<uuid>.<ext>`) and issues a one-time
 * address for exactly that name. The browser cannot choose the name.
 */
export async function issuePhotoUpload(
  store: PhotoCallerStore,
  parameters: { input: RequestPhotoUploadInput; userId: string; newId: () => string },
): Promise<{ path: string; token: string }> {
  const { input, userId, newId } = parameters;
  await ownEditableListing(store, input.listingId);
  if (input.bytes > PHOTO_MAX_BYTES) throw tooLarge();
  if ((await store.countPhotos(input.listingId)) >= PHOTO_MAX_COUNT) throw limitReached();
  const path = `${userId}/${input.listingId}/${newId()}.${PHOTO_EXTENSIONS[input.mime]}`;
  const { token } = await store.createSignedUpload(path);
  return { path, token };
}

const PROBLEM_KEYS: Record<ImageProblem, string> = {
  type: "validation.photoType",
  truncated: "validation.photoType",
  animated: "validation.photoType",
  metadata: "validation.photoNotPrepared",
};

/**
 * Step 2: the browser says it is done. The server reads the stored file and decides for itself: it is under
 * the size limit, its first bytes say it is a JPEG, PNG or WebP that matches the name it was stored under,
 * it carries no camera metadata, and its sides are in range. A file that fails is deleted at once. Only
 * then is the photo recorded.
 */
export async function acceptPhoto(
  callerStore: PhotoCallerStore,
  serverStore: PhotoServerStore,
  parameters: { input: FinalizePhotoInput; userId: string },
): Promise<{ photoId: string; path: string; shortId: string }> {
  const { input, userId } = parameters;
  const listing = await ownEditableListing(callerStore, input.listingId);

  const named = new RegExp(`^${userId}/${input.listingId}/${UUID}\\.(webp|jpg|png)$`).exec(
    input.path,
  );
  if (!named) {
    // Not a name this server issued for this caller and this listing.
    throw new ActionError("FORBIDDEN", "The path is not the caller's");
  }

  const refuse = async (error: ActionError): Promise<never> => {
    await discard(serverStore, input.path);
    throw error;
  };

  const stored = await serverStore.download(input.path);
  if (!stored) throw new ActionError("NOT_FOUND", "The file was not uploaded");
  if (stored.byteLength > PHOTO_MAX_BYTES) return refuse(tooLarge());

  const inspected = inspectImage(stored);
  if (!inspected.ok) return refuse(fail(PROBLEM_KEYS[inspected.reason]));
  if (PHOTO_EXTENSIONS[inspected.mime] !== named[1]) return refuse(fail("validation.photoType"));
  const { width, height } = inspected;
  if (Math.min(width, height) < PHOTO_MIN_EDGE || Math.max(width, height) > PHOTO_MAX_EDGE) {
    return refuse(fail("validation.photoDimensions"));
  }

  try {
    const photoId = await serverStore.finalize({
      ownerId: userId,
      listingId: input.listingId,
      path: input.path,
      mime: inspected.mime,
      bytes: stored.byteLength,
      width,
      height,
    });
    return { photoId, path: input.path, shortId: listing.shortId };
  } catch (error) {
    // The seventh photo, or a listing that closed in the meantime: the file has no row, so remove it now.
    await discard(serverStore, input.path);
    throw error;
  }
}

/**
 * Takes one photo off a listing the caller owns. The row goes first (the database decides: the caller must
 * own the listing and it must still be open); the file goes after, and if that fails the sweeper removes it.
 * The cover moves to the next photo by itself (database trigger), and a photo change on an approved listing
 * sends it back to review (policy C).
 */
export async function dropPhoto(
  callerStore: PhotoCallerStore,
  serverStore: Pick<PhotoServerStore, "deleteObject">,
  parameters: { input: RemovePhotoInput; onFileLeft?: (path: string) => void },
): Promise<{ shortId: string }> {
  const { input } = parameters;
  const listing = await ownEditableListing(callerStore, input.listingId);
  const removed = await callerStore.deletePhotoRow(input.listingId, input.photoId);
  if (!removed) throw new ActionError("NOT_FOUND", "The photo was not found");
  try {
    await serverStore.deleteObject(removed.storagePath);
  } catch {
    // The row is gone, so the photo is gone for the owner. The file is picked up by the sweeper.
    parameters.onFileLeft?.(removed.storagePath);
  }
  return { shortId: listing.shortId };
}
