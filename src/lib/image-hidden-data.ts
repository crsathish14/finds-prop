/**
 * Takes the hidden data out of a picture without touching a single pixel (image clean-up, step 1). Photos carry more than
 * the picture: the camera and phone model, the date, the GPS position of where it was taken, a small copy of the
 * picture, comments and editing history. None of it is needed to show the picture, some of it is private, and it adds
 * weight. This file works on the bytes of the file alone: it reads the structure (JPEG segments, PNG chunks, WebP
 * chunks), copies the parts that make the picture, and leaves the rest out. Nothing is decoded or encoded again, so the
 * picture is exactly the one that was chosen.
 *
 * Kept on purpose, because taking them out would change how the picture looks:
 *  - the colour profile (a phone photo in Display P3 looks dull without it) and the other colour and transparency
 *    chunks of a PNG;
 *  - the way the picture is turned, but only that: the camera's EXIF block is replaced by one with the turn and nothing
 *    else, so a portrait photo does not lie on its side and no GPS position or camera model survives.
 *
 * Refused: a file that is not a JPEG, PNG or WebP, one cut short, and an animation (the site shows still pictures).
 * Pure: no framework and no browser, so the same code runs in the browser (before upload) and on the server (to check).
 */

export type CleanableMime = "image/jpeg" | "image/png" | "image/webp";

export type StripProblem = "type" | "truncated" | "animated";

export type StripResult =
  | {
      ok: true;
      mime: CleanableMime;
      /** The picture without its hidden data. Always a new array, never the input. */
      bytes: Uint8Array;
      /** How many bytes were taken out (the input's length minus the output's). */
      removedBytes: number;
      /** The turn kept from the EXIF block (2 to 8), or `null` when the picture is not turned. */
      orientation: number | null;
    }
  | { ok: false; reason: StripProblem };

const refuse = (reason: StripProblem): StripResult => ({ ok: false, reason });

function bigEndian16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function bigEndian32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) * 0x1000000 +
      ((bytes[at + 1] ?? 0) << 16) +
      ((bytes[at + 2] ?? 0) << 8) +
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

function littleEndian32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) |
      ((bytes[at + 1] ?? 0) << 8) |
      ((bytes[at + 2] ?? 0) << 16) |
      ((bytes[at + 3] ?? 0) << 24)) >>>
    0
  );
}

function text(bytes: Uint8Array, at: number, length: number): string {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += String.fromCharCode(bytes[at + index] ?? 0);
  }
  return result;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function bigEndianBytes32(value: number): Uint8Array {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  );
}

function littleEndianBytes32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (letter) => letter.charCodeAt(0));
}

/* ----------------------------------------------------------------------------------------------- EXIF turn */

const ORIENTATION_TAG = 0x0112;
const SHORT_TYPE = 3;

/** The turn (1 to 8) written in a TIFF block (what an EXIF block holds), or `null` when there is none. */
function readTiffOrientation(tiff: Uint8Array): number | null {
  if (tiff.length < 8) return null;
  const order = text(tiff, 0, 2);
  const little = order === "II";
  if (!little && order !== "MM") return null;
  const read16 = (at: number) =>
    little ? (tiff[at] ?? 0) | ((tiff[at + 1] ?? 0) << 8) : bigEndian16(tiff, at);
  const read32 = (at: number) => (little ? littleEndian32(tiff, at) : bigEndian32(tiff, at));
  if (read16(2) !== 42) return null;
  const directory = read32(4);
  if (directory + 2 > tiff.length) return null;
  const count = Math.min(read16(directory), 256);
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > tiff.length) return null;
    if (read16(entry) !== ORIENTATION_TAG) continue;
    if (read16(entry + 2) !== SHORT_TYPE) return null;
    const value = read16(entry + 8);
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/** A TIFF block that holds the turn and nothing else: no GPS, no camera, no date. 26 bytes. */
function orientationTiff(orientation: number): Uint8Array {
  return Uint8Array.of(
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // big endian, 42, the first directory at 8
    0x00,
    0x01, // one entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00, // orientation, short, 1 value
    0x00,
    0x00,
    0x00,
    0x00, // no next directory
  );
}

/** A turn worth keeping: 1 means upright, which is what no EXIF block at all says too. */
function keptOrientation(orientation: number | null): number | null {
  return orientation !== null && orientation >= 2 && orientation <= 8 ? orientation : null;
}

/* ------------------------------------------------------------------------------------------------- JPEG */

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const EXIF_PREFIX = "Exif\0\0";
const ICC_PREFIX = "ICC_PROFILE\0";

/** The EXIF segment that holds only the turn: marker, length, `Exif\0\0`, the 26 byte TIFF block. */
function jpegOrientationSegment(orientation: number): Uint8Array {
  const tiff = orientationTiff(orientation);
  return join([Uint8Array.of(0xff, 0xe1, 0x00, 2 + 6 + tiff.length), ascii(EXIF_PREFIX), tiff]);
}

/**
 * JPEG is a row of segments: `FF`, a marker, a length and the data. Everything before the scan (`FFDA`) describes the
 * file and the picture data follows it up to the end marker (`FFD9`). Segments that make the picture (tables, frame,
 * the colour profile, the JFIF and Adobe headers) are copied; the camera's EXIF, XMP, IPTC, comments, thumbnails
 * (`JFXX`), multi-picture data and every other application segment are not. Anything after the end marker, such as the
 * extra pictures some phones append, is cut off.
 */
function stripJpeg(bytes: Uint8Array): StripResult {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: number | null = null;
  let exifSeen = false;
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return refuse("truncated");
    const marker = bytes[at + 1];
    if (marker === undefined) return refuse("truncated");
    // Any number of 0xFF bytes may pad before a marker.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // Markers with no length: the restart markers, the temporary one and another start of image.
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    // The end of the image before any picture data: nothing to show.
    if (marker === 0xd9) return refuse("truncated");
    if (at + 4 > bytes.length) return refuse("truncated");
    const length = bigEndian16(bytes, at + 2);
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) return refuse("truncated");
    const segment = bytes.subarray(at, end);

    if (marker === 0xda) {
      // The scan header, then the picture data up to the first end marker (it never occurs inside the data).
      parts.push(segment);
      for (let index = end; index + 1 < bytes.length; index += 1) {
        if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) {
          parts.push(bytes.subarray(end, index + 2));
          const output = join(parts);
          return {
            ok: true,
            mime: "image/jpeg",
            bytes: output,
            removedBytes: bytes.length - output.length,
            orientation,
          };
        }
      }
      return refuse("truncated");
    }

    if (marker === 0xe1 && text(bytes, at + 4, 6) === EXIF_PREFIX) {
      // The camera's block: only the turn survives, and only the first block counts.
      if (!exifSeen) {
        exifSeen = true;
        orientation = keptOrientation(readTiffOrientation(bytes.subarray(at + 10, end)));
        if (orientation !== null) parts.push(jpegOrientationSegment(orientation));
      }
    } else if (marker === 0xe0) {
      // Keep the JFIF header; the JFXX extension holds a thumbnail.
      if (text(bytes, at + 4, 5) === "JFIF\0") parts.push(segment);
    } else if (marker === 0xe2) {
      if (text(bytes, at + 4, 12) === ICC_PREFIX) parts.push(segment);
    } else if (marker === 0xee) {
      // Adobe's header says how the colours are stored; the picture reads wrongly without it.
      parts.push(segment);
    } else if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
      // XMP, IPTC, MPF, other makers' blocks and comments: left out.
    } else {
      parts.push(segment);
    }
    at = end;
  }
  return refuse("truncated");
}

/* -------------------------------------------------------------------------------------------------- PNG */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** The chunks that make a PNG picture, its transparency and its colours. Every other chunk is dropped. */
const PNG_KEPT = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "bKGD",
  "cICP",
  "mDCV",
  "cLLI",
]);

const PNG_ANIMATION = new Set(["acTL", "fcTL", "fdAT"]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let step = 0; step < 8; step += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = (CRC_TABLE[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** An `eXIf` chunk that holds only the turn. */
function pngOrientationChunk(orientation: number): Uint8Array {
  const body = join([ascii("eXIf"), orientationTiff(orientation)]);
  return join([bigEndianBytes32(26), body, bigEndianBytes32(crc32(body))]);
}

function stripPng(bytes: Uint8Array): StripResult {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let orientation: number | null = null;
  let exifSeen = false;
  let sawHeader = false;
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = bigEndian32(bytes, at);
    const name = text(bytes, at + 4, 4);
    const end = at + 12 + length;
    if (end > bytes.length) return refuse("truncated");
    if (PNG_ANIMATION.has(name)) return refuse("animated");
    if (name === "IHDR") sawHeader = true;
    if (name === "eXIf" && !exifSeen) {
      exifSeen = true;
      orientation = keptOrientation(readTiffOrientation(bytes.subarray(at + 8, at + 8 + length)));
      if (orientation !== null) parts.push(pngOrientationChunk(orientation));
    } else if (PNG_KEPT.has(name)) {
      parts.push(bytes.subarray(at, end));
    }
    at = end;
    if (name === "IEND") {
      if (!sawHeader) return refuse("truncated");
      const output = join(parts);
      return {
        ok: true,
        mime: "image/png",
        bytes: output,
        removedBytes: bytes.length - output.length,
        orientation,
      };
    }
  }
  return refuse("truncated");
}

/* ------------------------------------------------------------------------------------------------- WebP */

const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;
const VP8X_ANIMATION_FLAG = 0x02;

function webpChunk(name: string, data: Uint8Array): Uint8Array {
  const padding = data.length % 2 === 1 ? Uint8Array.of(0) : new Uint8Array(0);
  return join([ascii(name), littleEndianBytes32(data.length), data, padding]);
}

/**
 * WebP is a RIFF file: chunks of a four letter name, a length and data. The picture is `VP8 ` or `VP8L` (with `ALPH`
 * for transparency); `VP8X` says which extras there are; `ICCP` is the colour profile; `EXIF` and `XMP ` are the hidden
 * data. The `VP8X` flags are rewritten to match and the size at the top of the file is worked out again.
 */
function stripWebp(bytes: Uint8Array): StripResult {
  if (bytes.length < 12) return refuse("truncated");
  const total = littleEndian32(bytes, 4) + 8;
  if (total > bytes.length) return refuse("truncated");
  const chunks: Uint8Array[] = [];
  let header: Uint8Array | null = null;
  let orientation: number | null = null;
  let exifSeen = false;
  let sawPicture = false;
  let at = 12;
  while (at + 8 <= total) {
    const name = text(bytes, at, 4);
    const length = littleEndian32(bytes, at + 4);
    const data = at + 8;
    if (data + length > total) return refuse("truncated");
    const body = bytes.subarray(data, data + length);
    if (name === "ANIM" || name === "ANMF") return refuse("animated");
    if (name === "VP8X") {
      if (length < 10) return refuse("truncated");
      if ((body[0] ?? 0) & VP8X_ANIMATION_FLAG) return refuse("animated");
      header = body.slice();
    } else if (name === "EXIF" && !exifSeen) {
      exifSeen = true;
      const tiff = text(body, 0, 6) === EXIF_PREFIX ? body.subarray(6) : body;
      orientation = keptOrientation(readTiffOrientation(tiff));
    } else if (name === "ICCP" || name === "ALPH") {
      chunks.push(webpChunk(name, body));
    } else if (name === "VP8 " || name === "VP8L") {
      sawPicture = true;
      chunks.push(webpChunk(name, body));
    }
    at = data + length + (length % 2);
  }
  if (!sawPicture) return refuse("truncated");

  const output: Uint8Array[] = [];
  if (header) {
    // The EXIF and XMP flags follow what is left: the turn, if any, and no XMP.
    const flags =
      ((header[0] ?? 0) & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) |
      (orientation !== null ? VP8X_EXIF_FLAG : 0);
    header[0] = flags;
    output.push(webpChunk("VP8X", header));
  }
  output.push(...chunks);
  if (header && orientation !== null) output.push(webpChunk("EXIF", orientationTiff(orientation)));
  const body = join([ascii("WEBP"), ...output]);
  const result = join([ascii("RIFF"), littleEndianBytes32(body.length), body]);
  return {
    ok: true,
    mime: "image/webp",
    bytes: result,
    removedBytes: bytes.length - result.length,
    orientation: header ? orientation : null,
  };
}

/* ------------------------------------------------------------------------------------------------ entry */

/**
 * The picture's bytes without its hidden data (see the top of this file for what goes and what stays), or the reason it
 * cannot be treated: not a JPEG, PNG or WebP (`type`), cut short (`truncated`) or an animation (`animated`).
 */
export function stripHiddenData(bytes: Uint8Array): StripResult {
  if (startsWith(bytes, JPEG_SIGNATURE)) return stripJpeg(bytes);
  if (startsWith(bytes, PNG_SIGNATURE)) return stripPng(bytes);
  if (bytes.length >= 12 && text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 4) === "WEBP") {
    return stripWebp(bytes);
  }
  return refuse("type");
}

/**
 * What the server asks of a picture it has read back from storage (image clean-up, step 6): has the hidden data been
 * taken out? The browser does it before upload, so a picture that went through the site's own page is `clean`: stripping
 * it again removes nothing. `hidden` means something would still be taken out (a camera block, GPS, comments,
 * thumbnails, trailing data), so the file did not come through the page, or the browser was bypassed. `broken` is a file
 * that cannot be read as a whole still picture (cut short, an animation, or not a picture of a kind the site takes).
 */
export type PictureCleanliness = "clean" | "hidden" | "broken";

export function checkPictureClean(bytes: Uint8Array): PictureCleanliness {
  const result = stripHiddenData(bytes);
  if (!result.ok) return "broken";
  return result.removedBytes === 0 ? "clean" : "hidden";
}

export type StripFileResult =
  { ok: true; file: File; removedBytes: number } | { ok: false; reason: StripProblem };

/**
 * The same for a chosen file: reads it, takes the hidden data out and gives back a new file with the same name. The type
 * is the one the bytes really have, not the one the browser declared.
 */
export async function stripHiddenDataFromFile(file: File): Promise<StripFileResult> {
  const result = stripHiddenData(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return result;
  return {
    ok: true,
    removedBytes: result.removedBytes,
    file: new File([result.bytes as BlobPart], file.name, {
      type: result.mime,
      lastModified: file.lastModified,
    }),
  };
}
