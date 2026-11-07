/**
 * The limits of a listing photo (S6-T01, ADR-015, plan 07 section 7). The browser resizes to at most
 * 2000 pixels on the long edge before it uploads (S6-SPK-01); the server accepts a little more room
 * and checks again, because a browser can be bypassed.
 */
export const PHOTO_BUCKET = "listing-photos";

/** The only types a listing photo may have, with the extension each one is stored under. */
export const PHOTO_EXTENSIONS = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type PhotoMime = keyof typeof PHOTO_EXTENSIONS;

export const PHOTO_MIMES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const satisfies readonly PhotoMime[];

/** The bucket's own limit (10 MB); the server checks it again on the stored file. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** The same figure in whole megabytes, for the message that names it. */
export const PHOTO_MAX_MEGABYTES = 10;

/** At most this many photos on a listing (plan 06 6.2; the database trigger holds the same limit). */
export const PHOTO_MAX_COUNT = 6;

/** The shortest and longest side, in pixels, the server accepts. Out of range is refused. */
export const PHOTO_MIN_EDGE = 100;
export const PHOTO_MAX_EDGE = 4096;

/** A listing in one of these states may still change its photos (sold and rented may not). */
export const EDITABLE_STATUSES = ["draft", "pending", "rejected", "approved"] as const;

/** A file nobody claimed within this many hours is removed by the sweeper. */
export const SWEEP_AFTER_HOURS = 24;

/** The most files one sweep removes; the next hourly run takes the rest. */
export const SWEEP_BATCH = 500;

/** The name of the sweeper's token in `internal_cron_tokens`. */
export const SWEEP_TOKEN_NAME = "media_sweep";
