/**
 * Makes a picture lighter when it is over the limit, by lowering its quality, and nothing else (image clean-up, step 2).
 * It is used only after the hidden data has been taken out (`image-hidden-data.ts`) and the file is still too heavy, and
 * only when the person has said yes: lowering the quality cannot be undone for that file. The pixel size never changes.
 *
 * How: the highest quality that still fits. It tries the top quality first (a file that fits there is lowered as
 * little as possible), then the floor (a file that does not fit even there cannot be reduced and the person is asked for
 * another one), then narrows in between a few times. A JPEG stays a JPEG. A PNG or a WebP is saved as a WebP, which keeps
 * transparency; where the browser cannot make a WebP the file cannot be reduced, because a JPEG would turn the
 * transparent parts white.
 *
 * This file holds the rules and takes the browser's decoding and encoding as arguments, so they can be tested without a
 * browser. The real ones are in `image-browser.ts`.
 */

/** The lowest quality a picture is taken to, and the one for pictures with fine detail such as floor plans. */
export const QUALITY_FLOOR = 0.75;
export const QUALITY_FLOOR_DETAILED = 0.85;

/** The quality tried first. Above this the file grows with no difference the eye can see. */
export const QUALITY_CEILING = 0.95;

/** How many times the search narrows between the floor and the ceiling (the last step is under one percent). */
const SEARCH_STEPS = 6;

/** The biggest original the browser is asked to read (it is held in memory as pixels). */
export const REDUCE_INPUT_MAX_BYTES = 20 * 1024 * 1024;

/** A picture the browser has read, and whatever frees it. */
export interface DecodedPicture {
  width: number;
  height: number;
  close(): void;
}

export interface ReduceDeps {
  /** Reads the picture with its turn applied. Throws when the browser cannot read the file. */
  decode(file: Blob): Promise<DecodedPicture>;
  /**
   * Draws the picture at the given size and saves it as the given type at the given quality. Gives `null` when the
   * browser cannot make that type. A JPEG has no transparency, so it is drawn on white.
   */
  encode(
    picture: DecodedPicture,
    size: { width: number; height: number },
    type: "image/webp" | "image/jpeg",
    quality: number,
  ): Promise<Blob | null>;
}

export interface ReduceOptions {
  /** The most the file may weigh, in bytes. */
  targetBytes: number;
  /** The lowest quality to go to: `QUALITY_FLOOR`, or `QUALITY_FLOOR_DETAILED` for plans. */
  qualityFloor: number;
}

export type ReduceProblem = "not_image" | "too_large" | "unreadable" | "no_encoder" | "cannot_fit";

type ReducedMime = "image/jpeg" | "image/png" | "image/webp";

export type ReduceResult =
  | {
      ok: true;
      blob: Blob;
      mime: ReducedMime;
      /** The quality used, or `null` when the file already fitted and was left as it is. */
      quality: number | null;
      bytes: number;
      originalBytes: number;
      width: number;
      height: number;
    }
  | {
      ok: false;
      reason: ReduceProblem;
      /** For `cannot_fit`: the weight at the floor, so the message can say how far off it was. */
      smallestBytes: number | null;
    };

const failure = (reason: ReduceProblem, smallestBytes: number | null = null): ReduceResult => ({
  ok: false,
  reason,
  smallestBytes,
});

/** The type a file really has, from its first bytes (a declared type proves nothing). */
async function sniff(file: Blob): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
    return "image/png";
  const riff = String.fromCharCode(...head.subarray(0, 4));
  const webp = String.fromCharCode(...head.subarray(8, 12));
  return riff === "RIFF" && webp === "WEBP" ? "image/webp" : null;
}

const hundredths = (value: number) => Math.round(value * 100) / 100;

export async function reduceToSize(
  file: Blob,
  options: ReduceOptions,
  deps: ReduceDeps,
): Promise<ReduceResult> {
  const original = await sniff(file);
  if (original === null) return failure("not_image");
  if (file.size > REDUCE_INPUT_MAX_BYTES) return failure("too_large");
  if (file.size === 0) return failure("unreadable");

  let picture: DecodedPicture;
  try {
    picture = await deps.decode(file);
  } catch {
    return failure("unreadable");
  }
  try {
    if (!(picture.width > 0 && picture.height > 0)) return failure("unreadable");
    const size = { width: picture.width, height: picture.height };
    const done = (blob: Blob, mime: ReducedMime, quality: number | null): ReduceResult => ({
      ok: true,
      blob,
      mime,
      quality,
      bytes: blob.size,
      originalBytes: file.size,
      width: size.width,
      height: size.height,
    });
    // Already light enough: nothing to lower.
    if (file.size <= options.targetBytes) return done(file, original, null);

    const type = original === "image/jpeg" ? "image/jpeg" : "image/webp";
    const attempt = async (quality: number): Promise<Blob | null> => {
      try {
        const blob = await deps.encode(picture, size, type, quality);
        // A browser that cannot make WebP quietly hands back a PNG: only the asked-for type counts.
        return blob && blob.type === type && blob.size > 0 ? blob : null;
      } catch {
        return null;
      }
    };

    const floor = Math.min(options.qualityFloor, QUALITY_CEILING);
    const top = await attempt(QUALITY_CEILING);
    if (!top) return failure("no_encoder");
    if (top.size <= options.targetBytes) return done(top, type, QUALITY_CEILING);

    const bottom = await attempt(floor);
    if (!bottom) return failure("no_encoder");
    if (bottom.size > options.targetBytes) return failure("cannot_fit", bottom.size);

    // The floor fits and the ceiling does not: narrow in between to the highest quality that fits.
    let fitting = { blob: bottom, quality: floor };
    let low = floor;
    let high = QUALITY_CEILING;
    for (let step = 0; step < SEARCH_STEPS; step += 1) {
      const middle = hundredths((low + high) / 2);
      if (middle <= low || middle >= high) break;
      const blob = await attempt(middle);
      if (!blob) break;
      if (blob.size <= options.targetBytes) {
        fitting = { blob, quality: middle };
        low = middle;
      } else {
        high = middle;
      }
    }
    return done(fitting.blob, type, fitting.quality);
  } finally {
    picture.close();
  }
}
