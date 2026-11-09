import { SLOT_RATIOS, fitFor, type SponsorFit } from "@/lib/sponsors";
import { SPONSOR_IMAGE_MAX_BYTES } from "./constants";

/**
 * What makes a sponsor's picture acceptable (S7-T11, FR-ADM-11, DEC-15): the four slots a sponsor can fill, the types, the
 * weight and the size and shape of each picture. Pure: no framework and no storage, so the same rules run in the
 * browser (to tell the person at once, before anything is sent) and on the server (which reads the stored file itself
 * and never trusts what the browser says about it). The shape rule is the public side's own (`fitFor`): within 8% of
 * the slot a picture fills it, within 30% it is shown whole on a plain background, further off it is refused.
 */

export type SponsorFormat = "strip" | "panel";
export type SponsorDevice = "desktop" | "compact";

/** One of the four pictures of a sponsor. */
export interface SponsorSlot {
  format: SponsorFormat;
  device: SponsorDevice;
}

/** The slots in the order of the screen: strip desktop, strip phone, panel desktop, panel phone. */
export const SPONSOR_SLOTS: readonly SponsorSlot[] = [
  { format: "strip", device: "desktop" },
  { format: "strip", device: "compact" },
  { format: "panel", device: "desktop" },
  { format: "panel", device: "compact" },
];

/** The size a slot is shown at, and the smallest picture accepted (twice that, so it stays sharp on dense screens). */
export const SLOT_SIZES: Record<
  SponsorFormat,
  Record<
    SponsorDevice,
    { shown: { width: number; height: number }; minimum: { width: number; height: number } }
  >
> = {
  strip: {
    desktop: {
      shown: { width: 970, height: 90 },
      minimum: { width: 1940, height: 180 },
    },
    compact: {
      shown: { width: 320, height: 100 },
      minimum: { width: 640, height: 200 },
    },
  },
  panel: {
    desktop: {
      shown: { width: 524, height: 494 },
      minimum: { width: 1048, height: 988 },
    },
    compact: {
      shown: { width: 640, height: 320 },
      minimum: { width: 1280, height: 640 },
    },
  },
};

/** The most a picture may measure on either side (the stored shape allows no more). */
export const SPONSOR_IMAGE_MAX_SIDE = 6000;

export type SponsorImageType = "image/png" | "image/jpeg" | "image/webp";

export interface ImageInfo {
  type: SponsorImageType;
  width: number;
  height: number;
}

const be16 = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const be32 = (bytes: Uint8Array, at: number) =>
  (((bytes[at] ?? 0) << 24) |
    ((bytes[at + 1] ?? 0) << 16) |
    ((bytes[at + 2] ?? 0) << 8) |
    (bytes[at + 3] ?? 0)) >>>
  0;
const le16 = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const le24 = (bytes: Uint8Array, at: number) => le16(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(at, at + length)));

function pngInfo(bytes: Uint8Array): ImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return { type: "image/png", width: be32(bytes, 16), height: be32(bytes, 20) };
}

/** JPEG: walk the markers until a start-of-frame one, which holds the size. */
function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const startOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame) {
      return { type: "image/jpeg", width: be16(bytes, at + 7), height: be16(bytes, at + 5) };
    }
    // Markers with no length: a restart, the start of the image or a bare marker.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    at += 2 + be16(bytes, at + 2);
  }
  return null;
}

/** WebP: a RIFF file whose first chunk is lossy (VP8 ), lossless (VP8L) or extended (VP8X). */
function webpInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      type: "image/webp",
      width: le16(bytes, 26) & 0x3fff,
      height: le16(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return {
      type: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    return { type: "image/webp", width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
  return null;
}

/**
 * The type and the pixel size of a picture, read from the file's own first bytes. Nothing else is trusted: a name, a
 * declared type or a size sent by the browser can all be wrong, an SVG or a script renamed to `.png` has none of these
 * signatures, and a file that does not read cleanly gives `null`.
 */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const info = pngInfo(bytes) ?? jpegInfo(bytes) ?? webpInfo(bytes);
  if (!info || info.width < 1 || info.height < 1) return null;
  return info;
}

/** The file extension a stored picture of this type gets. */
export const EXTENSION_OF: Record<SponsorImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type SlotProblem = "type" | "size" | "small" | "shape";

/**
 * Why a picture cannot go in a slot, or `null` when it can. In this order: not a PNG, JPEG or WebP (`type`); heavier than
 * the limit (`size`); smaller than twice the slot, or past the largest side (`small`); a shape the slot cannot take even
 * shown whole (`shape`).
 */
export function slotProblem(
  slot: SponsorSlot,
  info: ImageInfo | null,
  bytes: number,
): SlotProblem | null {
  if (!info) return "type";
  if (bytes > SPONSOR_IMAGE_MAX_BYTES) return "size";
  const { minimum } = SLOT_SIZES[slot.format][slot.device];
  if (
    info.width < minimum.width ||
    info.height < minimum.height ||
    info.width > SPONSOR_IMAGE_MAX_SIDE ||
    info.height > SPONSOR_IMAGE_MAX_SIDE
  ) {
    return "small";
  }
  if (slotFit(slot, info) === "rejected") return "shape";
  return null;
}

/** How a picture sits in its slot on the public page: fills it, shown whole on a plain background, or refused. */
export function slotFit(slot: SponsorSlot, info: Pick<ImageInfo, "width" | "height">): SponsorFit {
  return fitFor(
    { src: "", width: info.width, height: info.height },
    SLOT_RATIOS[slot.format][slot.device],
  );
}
