/**
 * Tiny stand-in pictures for the sponsor tests: only the first bytes a real file starts with, which is all the
 * reader looks at (S7-T11). Each takes the pixel size to report, and pads to the weight asked for.
 */

const pad = (bytes: number[], total: number): Uint8Array => {
  const out = new Uint8Array(Math.max(total, bytes.length));
  out.set(bytes);
  return out;
};

const be32 = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const be16 = (value: number) => [(value >>> 8) & 255, value & 255];
const le16 = (value: number) => [value & 255, (value >>> 8) & 255];
const le24 = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
const text = (value: string) => Array.from(value).map((letter) => letter.charCodeAt(0));

export function png(width: number, height: number, total = 64): Uint8Array {
  return pad(
    [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...be32(13),
      ...text("IHDR"),
      ...be32(width),
      ...be32(height),
      8,
      6,
      0,
      0,
      0,
    ],
    total,
  );
}

export function jpeg(width: number, height: number, total = 64): Uint8Array {
  return pad(
    [
      0xff,
      0xd8,
      // An application segment the reader has to step over.
      0xff,
      0xe0,
      ...be16(4),
      0,
      0,
      // Start of frame: length, precision, height, width.
      0xff,
      0xc0,
      ...be16(11),
      8,
      ...be16(height),
      ...be16(width),
      3,
      1,
      0x22,
      0,
    ],
    total,
  );
}

export function webpLossy(width: number, height: number, total = 64): Uint8Array {
  return pad(
    [
      ...text("RIFF"),
      0,
      0,
      0,
      0,
      ...text("WEBP"),
      ...text("VP8 "),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0x9d,
      0x01,
      0x2a,
      ...le16(width),
      ...le16(height),
    ],
    total,
  );
}

export function webpLossless(width: number, height: number, total = 64): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14);
  return pad(
    [
      ...text("RIFF"),
      0,
      0,
      0,
      0,
      ...text("WEBP"),
      ...text("VP8L"),
      0,
      0,
      0,
      0,
      0x2f,
      bits & 255,
      (bits >>> 8) & 255,
      (bits >>> 16) & 255,
      (bits >>> 24) & 255,
    ],
    total,
  );
}

export function webpExtended(width: number, height: number, total = 64): Uint8Array {
  return pad(
    [
      ...text("RIFF"),
      0,
      0,
      0,
      0,
      ...text("WEBP"),
      ...text("VP8X"),
      10,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...le24(width - 1),
      ...le24(height - 1),
    ],
    total,
  );
}

/** What an SVG (or a script renamed to .png) looks like to the reader: no picture signature at all. */
export function notAPicture(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1940" height="180"></svg>',
  );
}
