import { PHOTO_MAX_BYTES, type PhotoMime } from "./constants";

/**
 * Gets a photo ready in the browser before it is uploaded (S6-T01, S6-SPK-01, ADR-015, plan 07 section 7).
 * The file is decoded with its camera rotation applied, scaled down so its longest side is at most
 * 2000 pixels (never enlarged), and drawn again onto a blank canvas and encoded as WebP at quality 0.8, or as
 * JPEG where the browser cannot make WebP. Drawing again is what removes the EXIF block and with it the GPS
 * position that could show where the owner lives: nothing but pixels is carried over. The server checks the
 * result again and refuses any file that still has metadata (ADR-058).
 *
 * This file holds the rules and takes the browser's decoding and encoding as arguments, so they can be
 * tested without a browser. The real ones are in `browser-image.ts`.
 */

/** The longest side of an uploaded photo, in pixels. */
export const PREPARE_MAX_EDGE = 2000;

/** Quality for the WebP and JPEG output. */
export const PREPARE_QUALITY = 0.8;

/** The biggest original the page will take (before it is made smaller), in bytes and in whole megabytes. */
export const ORIGINAL_MAX_BYTES = 20 * 1024 * 1024;
export const ORIGINAL_MAX_MEGABYTES = 20;

/** Types of file worth trying. HEIC is tried because some browsers (Safari) can read it. */
const TRY_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type PrepareProblem = "not_image" | "too_large" | "unreadable";

/** Why a file could not be prepared. The screen turns the problem into words. */
export class PrepareError extends Error {
  readonly problem: PrepareProblem;
  constructor(problem: PrepareProblem) {
    super(`The photo could not be prepared: ${problem}`);
    this.name = "PrepareError";
    this.problem = problem;
  }
}

/** A picture the browser has read: its size after the camera rotation, and whatever draws it. */
export interface DecodedImage {
  width: number;
  height: number;
  /** Frees the memory behind the picture. */
  close(): void;
}

export interface PrepareDeps {
  /** Reads the picture with its rotation applied. Throws when the browser cannot read the file. */
  decode(file: Blob): Promise<DecodedImage>;
  /**
   * Draws the picture at the given size on a blank canvas and encodes it. Returns null when the browser
   * cannot make that type. A JPEG has no transparency, so it is drawn on white.
   */
  encode(
    image: DecodedImage,
    size: { width: number; height: number },
    type: "image/webp" | "image/jpeg",
    quality: number,
  ): Promise<Blob | null>;
}

export interface PreparedPhoto {
  blob: Blob;
  mime: Extract<PhotoMime, "image/webp" | "image/jpeg">;
  width: number;
  height: number;
  bytes: number;
}

/** The size to draw at: the longest side at most `maxEdge`, the shape kept, never larger than the original. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = PREPARE_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function preparePhoto(file: Blob, deps: PrepareDeps): Promise<PreparedPhoto> {
  // An empty type happens on some phones; the browser's own decoder then decides.
  if (file.type !== "" && !TRY_TYPES.has(file.type.toLowerCase())) {
    throw new PrepareError("not_image");
  }
  if (file.size > ORIGINAL_MAX_BYTES) throw new PrepareError("too_large");
  if (file.size === 0) throw new PrepareError("unreadable");

  let image: DecodedImage;
  try {
    image = await deps.decode(file);
  } catch {
    throw new PrepareError("unreadable");
  }
  try {
    if (!(image.width > 0 && image.height > 0)) throw new PrepareError("unreadable");
    const size = fitWithin(image.width, image.height);
    for (const type of ["image/webp", "image/jpeg"] as const) {
      let blob: Blob | null;
      try {
        blob = await deps.encode(image, size, type, PREPARE_QUALITY);
      } catch {
        blob = null;
      }
      // A browser that cannot make WebP quietly hands back a PNG: only the asked-for type counts.
      if (!blob || blob.type !== type || blob.size === 0) continue;
      if (blob.size > PHOTO_MAX_BYTES) throw new PrepareError("too_large");
      return { blob, mime: type, width: size.width, height: size.height, bytes: blob.size };
    }
    throw new PrepareError("unreadable");
  } finally {
    image.close();
  }
}
