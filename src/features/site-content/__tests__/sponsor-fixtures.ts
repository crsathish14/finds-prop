/**
 * Tiny stand-in pictures for the sponsor tests: only the first bytes a real file starts with, which is all the
 * reader looks at (S7-T11). Each takes the pixel size to report, and pads to the weight asked for.
 */

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

/**
 * A whole PNG (the signature, the header, one data chunk of filler and the end), `total` bytes long or a little more:
 * the site takes the hidden data out of a picture before it reads it, and refuses a file that is cut short.
 */
export function png(width: number, height: number, total = 64): Uint8Array {
  const head = [
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
    0,
    0,
    0,
    0,
  ];
  const end = [...be32(0), ...text("IEND"), 0, 0, 0, 0];
  const filler = Math.max(0, total - head.length - 12 - end.length);
  const out = new Uint8Array(head.length + 12 + filler + end.length);
  out.set(head, 0);
  out.set([...be32(filler), ...text("IDAT")], head.length);
  out.set(end, head.length + 8 + filler + 4);
  return out;
}

/** A whole JPEG (JFIF header, frame, scan, filler, end), `total` bytes long or a little more. */
export function jpeg(width: number, height: number, total = 64): Uint8Array {
  const head = [
    0xff,
    0xd8,
    // The JFIF header.
    0xff,
    0xe0,
    ...be16(16),
    ...text("JFIF"),
    0,
    1,
    1,
    0,
    ...be16(1),
    ...be16(1),
    0,
    0,
    // Start of frame: length, precision, height, width, three components.
    0xff,
    0xc0,
    ...be16(17),
    8,
    ...be16(height),
    ...be16(width),
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
    // Start of scan.
    0xff,
    0xda,
    ...be16(12),
    3,
    1,
    0,
    2,
    0x11,
    3,
    0x11,
    0,
    0x3f,
    0,
  ];
  const end = [0xff, 0xd9];
  const out = new Uint8Array(Math.max(total, head.length + end.length));
  out.set(head, 0);
  out.set(end, out.length - end.length);
  return out;
}

/** A RIFF file around one chunk of the given name and data, padded to `total` bytes or a little more. */
function riff(chunks: number[][], total: number): Uint8Array {
  const body = chunks.flat();
  const last = chunks[chunks.length - 1] as number[];
  const wanted = Math.max(0, total - 12 - body.length);
  // The last chunk is the picture: its data grows by the filler, kept so its length is even (a chunk has no padding then).
  const filler = (last.length - 8 + wanted) % 2 === 0 ? wanted : wanted + 1;
  const grown = [...last.slice(0, 4), ...le32(last.length - 8 + filler), ...last.slice(8)];
  const parts = [...chunks.slice(0, -1).flat(), ...grown, ...new Array(filler).fill(0)];
  return Uint8Array.from([...text("RIFF"), ...le32(4 + parts.length), ...text("WEBP"), ...parts]);
}
const le32 = (value: number) => [
  value & 255,
  (value >>> 8) & 255,
  (value >>> 16) & 255,
  (value >>> 24) & 255,
];

export function webpLossy(width: number, height: number, total = 64): Uint8Array {
  const data = [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)];
  return riff([[...text("VP8 "), ...le32(data.length), ...data]], total);
}

export function webpLossless(width: number, height: number, total = 64): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14);
  const data = [0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255];
  return riff([[...text("VP8L"), ...le32(data.length), ...data]], total);
}

export function webpExtended(width: number, height: number, total = 64): Uint8Array {
  const header = [
    ...text("VP8X"),
    ...le32(10),
    0,
    0,
    0,
    0,
    ...le24(width - 1),
    ...le24(height - 1),
  ];
  const data = [0x2f, 0, 0, 0, 0];
  return riff([header, [...text("VP8L"), ...le32(data.length), ...data]], total);
}

/** What an SVG (or a script renamed to .png) looks like to the reader: no picture signature at all. */
export function notAPicture(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1940" height="180"></svg>',
  );
}
