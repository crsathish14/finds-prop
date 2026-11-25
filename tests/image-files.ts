/**
 * Small pictures with real bytes, for tests of the upload boxes. The site now reads a chosen file's own bytes (a name or a
 * declared type proves nothing), so a test that wants "a PNG" must give it the structure of one. Nothing here is decoded:
 * the tests that need decoding give the code their own stand-in browser.
 */

const text = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0));

function join(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

const be32 = (value: number) =>
  Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);

const pngChunk = (name: string, data: Uint8Array) =>
  join(be32(data.length), text(name), data, new Uint8Array(4));

const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/** A PNG whose picture data is `dataBytes` long, so the file is a little more than that. */
export function pngBytes(dataBytes = 8): Uint8Array<ArrayBuffer> {
  return join(
    PNG_SIGNATURE,
    pngChunk("IHDR", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
    pngChunk("IDAT", new Uint8Array(dataBytes)),
    pngChunk("IEND", new Uint8Array(0)),
  );
}

/** A JPEG whose picture data is `dataBytes` long. */
export function jpegBytes(dataBytes = 8): Uint8Array<ArrayBuffer> {
  return join(
    Uint8Array.of(0xff, 0xd8),
    Uint8Array.of(0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0),
    new Uint8Array(dataBytes),
    Uint8Array.of(0xff, 0xd9),
  );
}

/** A lossless WebP whose picture data is `dataBytes` long (an even number). */
export function webpBytes(dataBytes = 8): Uint8Array<ArrayBuffer> {
  const picture = join(Uint8Array.of(0x2f), new Uint8Array(dataBytes - 1));
  const chunk = join(
    text("VP8L"),
    Uint8Array.of(dataBytes & 0xff, (dataBytes >> 8) & 0xff, 0, 0),
    picture,
  );
  const body = join(text("WEBP"), chunk);
  return join(
    text("RIFF"),
    Uint8Array.of(body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff, 0),
    body,
  );
}

type Kind = "image/png" | "image/jpeg" | "image/webp";

const BUILD: Record<Kind, (dataBytes: number) => Uint8Array<ArrayBuffer>> = {
  "image/png": pngBytes,
  "image/jpeg": jpegBytes,
  "image/webp": webpBytes,
};

const ENDING: Record<Kind, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** A picture file of the given kind, light unless `dataBytes` says otherwise. */
export function pictureFile(kind: Kind = "image/png", dataBytes = 8, name?: string): File {
  return new File([BUILD[kind](dataBytes)], name ?? `picture.${ENDING[kind]}`, { type: kind });
}
