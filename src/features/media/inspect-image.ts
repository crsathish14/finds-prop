import type { PhotoMime } from "./constants";

/**
 * Reads the real type and size of an image from its bytes (S6-T01, plan 07 section 7). The file's
 * name and the type the browser declared prove nothing, so the server looks at the first bytes (the
 * "magic" bytes), the dimensions in the header, and whether the file still carries camera metadata.
 *
 * It does not decode pixels and it fetches nothing. It also refuses what a listing photo never is:
 * a file of any other type (an SVG or HTML page included), an animation, and a file cut short.
 *
 * Metadata: the browser re-encodes every photo, which drops the EXIF block (and with it the GPS
 * position that could show where the owner lives). A file that still has one did not come from our
 * page, so it is refused instead of repaired.
 */
export type ImageInfo = { mime: PhotoMime; width: number; height: number };

export type ImageProblem = "type" | "truncated" | "metadata" | "animated";

export type ImageInspection = ({ ok: true } & ImageInfo) | { ok: false; reason: ImageProblem };

const refuse = (reason: ImageProblem): ImageInspection => ({ ok: false, reason });

function word16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function word32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) * 0x1000000 +
      ((bytes[at + 1] ?? 0) << 16) +
      ((bytes[at + 2] ?? 0) << 8) +
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

function littleEndian24(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
}

function littleEndian32(bytes: Uint8Array, at: number): number {
  return (littleEndian24(bytes, at) | ((bytes[at + 3] ?? 0) << 24)) >>> 0;
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

// JPEG: segments of 0xFF, a marker byte and a length. The size is in the first "start of frame".
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

function inspectJpeg(bytes: Uint8Array): ImageInspection {
  let width = 0;
  let height = 0;
  let hasExif = false;
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return refuse("truncated");
    let marker = bytes[at + 1];
    // Any number of 0xFF bytes may pad before a marker.
    while (marker === 0xff) {
      at += 1;
      marker = bytes[at + 1];
    }
    if (marker === undefined) return refuse("truncated");
    at += 2;
    // Markers with no length: the restart markers, the temporary one and the start of image.
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break; // end of image
    if (at + 2 > bytes.length) return refuse("truncated");
    const length = word16(bytes, at);
    if (length < 2 || at + length > bytes.length) return refuse("truncated");
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (length < 8) return refuse("truncated");
      height = word16(bytes, at + 3);
      width = word16(bytes, at + 5);
    } else if (marker === 0xe1 && text(bytes, at + 2, 6) === "Exif\0\0") {
      hasExif = true;
    }
    // The picture data follows the scan header; everything that describes the file came before it.
    if (marker === 0xda) break;
    at += length;
  }
  if (width === 0 || height === 0) return refuse("truncated");
  if (hasExif) return refuse("metadata");
  return { ok: true, mime: "image/jpeg", width, height };
}

// PNG: an 8 byte signature, then chunks of length, a four letter name, data and a check value.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function inspectPng(bytes: Uint8Array): ImageInspection {
  let width = 0;
  let height = 0;
  let hasExif = false;
  let animated = false;
  let ended = false;
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = word32(bytes, at);
    const name = text(bytes, at + 4, 4);
    if (at + 12 + length > bytes.length) return refuse("truncated");
    if (name === "IHDR") {
      if (length < 8) return refuse("truncated");
      width = word32(bytes, at + 8);
      height = word32(bytes, at + 12);
    } else if (name === "eXIf") hasExif = true;
    else if (name === "acTL") animated = true;
    else if (name === "IEND") {
      ended = true;
      break;
    }
    at += 12 + length;
  }
  if (!ended || width === 0 || height === 0) return refuse("truncated");
  if (animated) return refuse("animated");
  if (hasExif) return refuse("metadata");
  return { ok: true, mime: "image/png", width, height };
}

// WebP: a RIFF container of chunks (a four letter name, a little endian length, data, padding).
function inspectWebp(bytes: Uint8Array): ImageInspection {
  let width = 0;
  let height = 0;
  let hasExif = false;
  let animated = false;
  let canvas: { width: number; height: number } | null = null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const name = text(bytes, at, 4);
    const length = littleEndian32(bytes, at + 4);
    const data = at + 8;
    if (data + length > bytes.length) return refuse("truncated");
    if (name === "VP8X") {
      if (length < 10) return refuse("truncated");
      const flags = bytes[data] ?? 0;
      if (flags & 0x08) hasExif = true;
      if (flags & 0x02) animated = true;
      canvas = {
        width: littleEndian24(bytes, data + 4) + 1,
        height: littleEndian24(bytes, data + 7) + 1,
      };
    } else if (name === "VP8 ") {
      // A 3 byte frame tag, the start code 9D 01 2A, then two 14 bit sizes.
      if (length < 10 || !startsWith(bytes.subarray(data + 3), [0x9d, 0x01, 0x2a])) {
        return refuse("truncated");
      }
      width = ((bytes[data + 6] ?? 0) | ((bytes[data + 7] ?? 0) << 8)) & 0x3fff;
      height = ((bytes[data + 8] ?? 0) | ((bytes[data + 9] ?? 0) << 8)) & 0x3fff;
    } else if (name === "VP8L") {
      // The signature byte 0x2F, then two 14 bit sizes (each one less than the real size).
      if (length < 5 || bytes[data] !== 0x2f) return refuse("truncated");
      const packed = littleEndian32(bytes, data + 1);
      width = (packed & 0x3fff) + 1;
      height = ((packed >>> 14) & 0x3fff) + 1;
    } else if (name === "EXIF") hasExif = true;
    else if (name === "ANIM" || name === "ANMF") animated = true;
    at = data + length + (length % 2);
  }
  if (canvas) {
    width = canvas.width;
    height = canvas.height;
  }
  if (width === 0 || height === 0) return refuse("truncated");
  if (animated) return refuse("animated");
  if (hasExif) return refuse("metadata");
  return { ok: true, mime: "image/webp", width, height };
}

/** Looks at the bytes of an uploaded file and says what it really is, or why it is refused. */
export function inspectImage(bytes: Uint8Array): ImageInspection {
  if (startsWith(bytes, JPEG_SIGNATURE)) return inspectJpeg(bytes);
  if (startsWith(bytes, PNG_SIGNATURE)) return inspectPng(bytes);
  if (bytes.length >= 12 && text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 4) === "WEBP") {
    return inspectWebp(bytes);
  }
  return refuse("type");
}
