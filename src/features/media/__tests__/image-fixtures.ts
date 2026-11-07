/** Small files built byte by byte: just enough structure for the reader, no picture data. */
export const bytes = (
  ...parts: (number | string | Uint8Array | number[])[]
): Uint8Array<ArrayBuffer> => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "number") out.push(part);
    else if (typeof part === "string") for (const ch of part) out.push(ch.charCodeAt(0));
    else out.push(...part);
  }
  return Uint8Array.from(out);
};
export const be16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
export const be32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
];
export const le24 = (value: number) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
export const le32 = (value: number) => [...le24(value), (value >>> 24) & 0xff];

export function jpeg(options: {
  width: number;
  height: number;
  exif?: boolean;
  progressive?: boolean;
  cut?: boolean;
}) {
  const frame = bytes(
    0xff,
    options.progressive ? 0xc2 : 0xc0,
    be16(17),
    8,
    be16(options.height),
    be16(options.width),
    3,
    [1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );
  const exif = options.exif
    ? bytes(0xff, 0xe1, be16(2 + 6 + 4), "Exif\0\0", [1, 2, 3, 4])
    : bytes();
  const jfif = bytes(0xff, 0xe0, be16(16), "JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const scan = bytes(
    0xff,
    0xda,
    be16(12),
    [3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0],
    [1, 2, 3],
    0xff,
    0xd9,
  );
  const whole = bytes(0xff, 0xd8, jfif, exif, frame, scan);
  return options.cut ? whole.subarray(0, 30) : whole;
}

export function png(options: {
  width: number;
  height: number;
  exif?: boolean;
  animated?: boolean;
  ended?: boolean;
}) {
  const chunk = (name: string, data: number[]) =>
    bytes(be32(data.length), name, data, [0, 0, 0, 0]);
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    chunk("IHDR", [...be32(options.width), ...be32(options.height), 8, 2, 0, 0, 0]),
    options.animated ? chunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0]) : bytes(),
    chunk("IDAT", [1, 2, 3]),
    options.exif ? chunk("eXIf", [1, 2, 3, 4]) : bytes(),
    options.ended === false ? bytes() : chunk("IEND", []),
  );
}

export function webpLossy(width: number, height: number, extra: Uint8Array = bytes()) {
  const frame = [
    0x10,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    ...[width & 0xff, width >> 8],
    ...[height & 0xff, height >> 8],
    0,
    0,
  ];
  const body = bytes("WEBP", "VP8 ", le32(frame.length), frame, extra);
  return bytes("RIFF", le32(body.length), body);
}

export function webpLossless(width: number, height: number) {
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const frame = [0x2f, ...le32(packed), 0, 0];
  const body = bytes("WEBP", "VP8L", le32(frame.length), frame);
  return bytes("RIFF", le32(body.length), body);
}

export function webpExtended(options: {
  width: number;
  height: number;
  flags: number;
  extraChunk?: Uint8Array;
}) {
  const vp8x = bytes(
    "VP8X",
    le32(10),
    options.flags,
    [0, 0, 0],
    le24(options.width - 1),
    le24(options.height - 1),
  );
  const body = bytes("WEBP", vp8x, options.extraChunk ?? bytes());
  return bytes("RIFF", le32(body.length), body);
}
