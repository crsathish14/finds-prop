import { describe, expect, it } from "vitest";
import { stripHiddenData, stripHiddenDataFromFile } from "../image-hidden-data";

type Part = Uint8Array | readonly number[] | string;

const toBytes = (part: Part): Uint8Array =>
  typeof part === "string"
    ? Uint8Array.from(part, (letter) => letter.charCodeAt(0))
    : Uint8Array.from(part);

function join(...parts: Part[]): Uint8Array {
  const all = parts.map(toBytes);
  const joined = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of all) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

const asText = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const contains = (bytes: Uint8Array, word: string) => asText(bytes).includes(word);

/** The 26 byte block that holds only a turn (the same bytes the production code writes, spelled out here). */
const turnOnly = (orientation: number) => [
  0x4d,
  0x4d,
  0x00,
  0x2a,
  0x00,
  0x00,
  0x00,
  0x08,
  0x00,
  0x01,
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
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
];

/** A camera's TIFF block with a turn, written the way the camera chooses (big or little endian) and a secret after it. */
const cameraTiff = (orientation: number, little = false) =>
  little
    ? join(
        "II",
        [0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00],
        [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00],
        "GPS-SECRET",
      )
    : join(
        "MM",
        [0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01],
        [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00],
        "GPS-SECRET",
      );

describe("UT-image-hidden-data: JPEG", () => {
  const segment = (marker: number, payload: Part) => {
    const body = toBytes(payload);
    return join([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff], body);
  };
  const jfif = segment(0xe0, join("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0]));
  const icc = segment(0xe2, join("ICC_PROFILE\0", [1, 1, 9, 9, 9, 9]));
  const adobe = segment(0xee, join("Adobe", [0, 100, 0, 0, 0, 0, 1]));
  const tables = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, index) => index + 1)]);
  const frame = segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  const scan = segment(0xda, [1, 1, 0, 0, 0x3f, 0]);
  // Picture data holds a stuffed 0xFF (FF 00) and a restart marker (FF D0), neither of which ends the picture.
  const pixels = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78];
  const end = [0xff, 0xd9];
  const start = [0xff, 0xd8];

  const camera = (orientation: number, little = false) =>
    segment(0xe1, join("Exif\0\0", cameraTiff(orientation, little)));
  const secrets = [
    segment(0xe0, join("JFXX\0", [0x10], "THUMB-SECRET")),
    segment(0xe1, join("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>XMP-SECRET</x:xmpmeta>")),
    segment(0xe2, join("MPF\0", "MPF-SECRET")),
    segment(0xed, join("Photoshop 3.0\0", "IPTC-SECRET")),
    segment(0xfe, "COMMENT-SECRET"),
  ];

  const photo = (orientation: number | null, trailer = "TRAILER-SECRET") =>
    join(
      start,
      jfif,
      ...(orientation === null ? [] : [camera(orientation)]),
      ...secrets,
      icc,
      adobe,
      tables,
      frame,
      scan,
      pixels,
      end,
      trailer,
    );

  it("leaves out the camera block, XMP, IPTC, comments, thumbnails and everything after the picture", () => {
    const input = photo(6);
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    for (const word of ["SECRET", "xmpmeta", "MPF", "Photoshop"]) {
      expect(contains(result.bytes, word)).toBe(false);
    }
    expect(result.removedBytes).toBe(input.length - result.bytes.length);
    expect(result.removedBytes).toBeGreaterThan(0);
  });

  it("keeps every byte of the picture itself, and the colour profile", () => {
    const result = stripHiddenData(photo(6));
    if (!result.ok) throw new Error("expected a clean picture");
    const expected = join(
      start,
      jfif,
      segment(0xe1, join("Exif\0\0", turnOnly(6))),
      icc,
      adobe,
      tables,
      frame,
      scan,
      pixels,
      end,
    );
    expect(Array.from(result.bytes)).toEqual(Array.from(expected));
    expect(result.mime).toBe("image/jpeg");
  });

  it("keeps the turn and nothing else of the camera block", () => {
    const result = stripHiddenData(photo(6));
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBe(6);
  });

  it("reads a turn written little endian", () => {
    const result = stripHiddenData(
      join(start, jfif, camera(3, true), tables, frame, scan, pixels, end),
    );
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBe(3);
    expect(contains(result.bytes, "GPS-SECRET")).toBe(false);
  });

  it("writes no block at all for a picture that is upright or has no camera block", () => {
    for (const input of [photo(1), photo(null)]) {
      const result = stripHiddenData(input);
      if (!result.ok) throw new Error("expected a clean picture");
      expect(result.orientation).toBeNull();
      expect(contains(result.bytes, "Exif")).toBe(false);
    }
  });

  it("gives the same bytes when run again on its own output", () => {
    const first = stripHiddenData(photo(8));
    if (!first.ok) throw new Error("expected a clean picture");
    const second = stripHiddenData(first.bytes);
    if (!second.ok) throw new Error("expected a clean picture");
    expect(Array.from(second.bytes)).toEqual(Array.from(first.bytes));
    expect(second.orientation).toBe(8);
    expect(second.removedBytes).toBe(0);
  });

  it("never returns the input array", () => {
    const input = photo(null, "");
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.bytes).not.toBe(input);
  });

  it("refuses a picture cut short", () => {
    const whole = photo(6);
    expect(stripHiddenData(whole.subarray(0, whole.length - 20))).toEqual({
      ok: false,
      reason: "truncated",
    });
    expect(stripHiddenData(join(start, jfif, tables))).toEqual({ ok: false, reason: "truncated" });
    expect(stripHiddenData(join(start, [0xff, 0xe1, 0x00]))).toEqual({
      ok: false,
      reason: "truncated",
    });
  });
});

describe("UT-image-hidden-data: PNG", () => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const checkValue = [0xde, 0xad, 0xbe, 0xef];
  const chunk = (name: string, data: Part = [], check: readonly number[] = checkValue) => {
    const body = toBytes(data);
    return join(
      [
        (body.length >>> 24) & 0xff,
        (body.length >>> 16) & 0xff,
        (body.length >>> 8) & 0xff,
        body.length & 0xff,
      ],
      name,
      body,
      check,
    );
  };
  const header = chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const pixels = chunk("IDAT", [9, 9, 9]);
  const end = chunk("IEND");

  /** The chunks of a file, in order: name and data. */
  function chunks(bytes: Uint8Array) {
    const found: { name: string; data: Uint8Array; check: Uint8Array }[] = [];
    let at = 8;
    while (at + 12 <= bytes.length) {
      const length =
        (bytes[at] ?? 0) * 0x1000000 +
        ((bytes[at + 1] ?? 0) << 16) +
        ((bytes[at + 2] ?? 0) << 8) +
        (bytes[at + 3] ?? 0);
      found.push({
        name: asText(bytes.subarray(at + 4, at + 8)),
        data: bytes.subarray(at + 8, at + 8 + length),
        check: bytes.subarray(at + 8 + length, at + 12 + length),
      });
      at += 12 + length;
    }
    return found;
  }

  /** The check value of a chunk, worked out bit by bit (a different way from the production code). */
  function checkValueOf(bytes: Uint8Array): number[] {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit += 1)
        value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    value = (value ^ 0xffffffff) >>> 0;
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  }

  const input = join(
    signature,
    header,
    chunk("tEXt", "Comment\0TEXT-SECRET"),
    chunk("eXIf", cameraTiff(6)),
    chunk("tIME", [7, 234, 11, 25, 1, 2, 3]),
    chunk("gAMA", [0, 1, 134, 160]),
    chunk("iCCP", "profile\0\0DATA"),
    chunk("pHYs", [0, 0, 11, 19, 0, 0, 11, 19, 1]),
    chunk("tRNS", [0, 0]),
    pixels,
    chunk("zTXt", "Title\0\0ZTXT-SECRET"),
    end,
    "TRAILER-SECRET",
  );

  it("keeps the picture, its transparency and its colours, and drops text, time and the rest", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.mime).toBe("image/png");
    expect(chunks(result.bytes).map((entry) => entry.name)).toEqual([
      "IHDR",
      "eXIf",
      "gAMA",
      "iCCP",
      "tRNS",
      "IDAT",
      "IEND",
    ]);
    expect(contains(result.bytes, "SECRET")).toBe(false);
    expect(result.removedBytes).toBe(input.length - result.bytes.length);
  });

  it("copies the kept chunks byte for byte", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    const kept = chunks(result.bytes).filter((entry) => entry.name !== "eXIf");
    const original = chunks(input);
    for (const entry of kept) {
      const same = original.find((candidate) => candidate.name === entry.name);
      expect(Array.from(entry.data)).toEqual(Array.from(same?.data ?? []));
      expect(Array.from(entry.check)).toEqual(checkValue);
    }
  });

  it("replaces the camera block by one that holds only the turn, with a correct check value", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBe(6);
    const exif = chunks(result.bytes).find((entry) => entry.name === "eXIf");
    expect(Array.from(exif?.data ?? [])).toEqual(turnOnly(6));
    expect(Array.from(exif?.check ?? [])).toEqual(checkValueOf(join("eXIf", exif?.data ?? [])));
  });

  it("gives the same bytes when run again on its own output", () => {
    const first = stripHiddenData(input);
    if (!first.ok) throw new Error("expected a clean picture");
    const second = stripHiddenData(first.bytes);
    if (!second.ok) throw new Error("expected a clean picture");
    expect(Array.from(second.bytes)).toEqual(Array.from(first.bytes));
    expect(second.orientation).toBe(6);
  });

  it("writes no block for an upright picture", () => {
    const result = stripHiddenData(
      join(signature, header, chunk("eXIf", cameraTiff(1)), pixels, end),
    );
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBeNull();
    expect(chunks(result.bytes).map((entry) => entry.name)).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("refuses an animation and a file without an end", () => {
    expect(
      stripHiddenData(
        join(signature, header, chunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0]), pixels, end),
      ),
    ).toEqual({ ok: false, reason: "animated" });
    expect(stripHiddenData(join(signature, header, pixels))).toEqual({
      ok: false,
      reason: "truncated",
    });
    expect(stripHiddenData(join(signature, chunk("IDAT", [1]), end))).toEqual({
      ok: false,
      reason: "truncated",
    });
  });
});

describe("UT-image-hidden-data: WebP", () => {
  const le32 = (value: number) => [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
  const chunk = (name: string, data: Part) => {
    const body = toBytes(data);
    return join(name, le32(body.length), body, body.length % 2 === 1 ? [0] : []);
  };
  const riff = (...chunksOf: Uint8Array[]) => {
    const body = join("WEBP", ...chunksOf);
    return join("RIFF", le32(body.length), body);
  };
  const extended = (flags: number) => chunk("VP8X", [flags, 0, 0, 0, 3, 0, 0, 1, 0, 0]);
  const picture = chunk("VP8L", [0x2f, 1, 2, 3, 4, 5, 6]);
  const profile = chunk("ICCP", [1, 2, 3]);
  const alpha = chunk("ALPH", [7, 7, 7, 7, 7]);

  /** The chunks of a file, in order. */
  function chunks(bytes: Uint8Array) {
    const found: { name: string; data: Uint8Array }[] = [];
    let at = 12;
    while (at + 8 <= bytes.length) {
      const length =
        (bytes[at + 4] ?? 0) | ((bytes[at + 5] ?? 0) << 8) | ((bytes[at + 6] ?? 0) << 16);
      found.push({
        name: asText(bytes.subarray(at, at + 4)),
        data: bytes.subarray(at + 8, at + 8 + length),
      });
      at += 8 + length + (length % 2);
    }
    return found;
  }

  const input = riff(
    extended(0x20 | 0x10 | 0x08 | 0x04),
    profile,
    alpha,
    picture,
    chunk("EXIF", cameraTiff(8, true)),
    chunk("XMP ", "<x:xmpmeta>XMP-SECRET</x:xmpmeta>"),
    chunk("JUNK", "JUNK-SECRET"),
  );

  it("keeps the picture, its transparency and colour profile, and drops the camera block, XMP and the rest", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.mime).toBe("image/webp");
    expect(chunks(result.bytes).map((entry) => entry.name)).toEqual([
      "VP8X",
      "ICCP",
      "ALPH",
      "VP8L",
      "EXIF",
    ]);
    expect(contains(result.bytes, "SECRET")).toBe(false);
    const kept = chunks(result.bytes);
    expect(Array.from(kept[1]?.data ?? [])).toEqual([1, 2, 3]);
    expect(Array.from(kept[2]?.data ?? [])).toEqual([7, 7, 7, 7, 7]);
    expect(Array.from(kept[3]?.data ?? [])).toEqual([0x2f, 1, 2, 3, 4, 5, 6]);
  });

  it("keeps only the turn and sets the flags to match", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBe(8);
    const found = chunks(result.bytes);
    expect(found[0]?.data[0]).toBe(0x20 | 0x10 | 0x08);
    expect(Array.from(found[4]?.data ?? [])).toEqual(turnOnly(8));
  });

  it("writes a file size that matches the file", () => {
    const result = stripHiddenData(input);
    if (!result.ok) throw new Error("expected a clean picture");
    const declared =
      (result.bytes[4] ?? 0) |
      ((result.bytes[5] ?? 0) << 8) |
      ((result.bytes[6] ?? 0) << 16) |
      ((result.bytes[7] ?? 0) << 24);
    expect(declared + 8).toBe(result.bytes.length);
    expect(result.removedBytes).toBe(input.length - result.bytes.length);
  });

  it("clears the turn flag for an upright picture and writes no block", () => {
    const result = stripHiddenData(
      riff(
        extended(0x08 | 0x04),
        picture,
        chunk("EXIF", cameraTiff(1)),
        chunk("XMP ", "XMP-SECRET"),
      ),
    );
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.orientation).toBeNull();
    const found = chunks(result.bytes);
    expect(found.map((entry) => entry.name)).toEqual(["VP8X", "VP8L"]);
    expect(found[0]?.data[0]).toBe(0);
  });

  it("gives the same bytes when run again on its own output", () => {
    const first = stripHiddenData(input);
    if (!first.ok) throw new Error("expected a clean picture");
    const second = stripHiddenData(first.bytes);
    if (!second.ok) throw new Error("expected a clean picture");
    expect(Array.from(second.bytes)).toEqual(Array.from(first.bytes));
    expect(second.orientation).toBe(8);
  });

  it("cuts off what follows a plain file and changes nothing else", () => {
    const plain = riff(picture);
    const result = stripHiddenData(join(plain, "TRAILER-SECRET"));
    if (!result.ok) throw new Error("expected a clean picture");
    expect(Array.from(result.bytes)).toEqual(Array.from(plain));
  });

  it("refuses an animation and a file cut short", () => {
    expect(
      stripHiddenData(riff(extended(0x02), chunk("ANIM", [0, 0, 0, 0, 0, 0]), picture)),
    ).toEqual({
      ok: false,
      reason: "animated",
    });
    expect(stripHiddenData(riff(extended(0), chunk("ANMF", [0]), picture))).toEqual({
      ok: false,
      reason: "animated",
    });
    expect(stripHiddenData(input.subarray(0, input.length - 30))).toEqual({
      ok: false,
      reason: "truncated",
    });
    expect(stripHiddenData(riff(extended(0)))).toEqual({ ok: false, reason: "truncated" });
  });
});

describe("UT-image-hidden-data: other files", () => {
  it("refuses a file that is not a JPEG, PNG or WebP, whatever it is called", () => {
    for (const bytes of [
      toBytes("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
      toBytes("GIF89a"),
      toBytes("%PDF-1.7"),
      new Uint8Array(0),
      Uint8Array.of(1, 2, 3),
    ]) {
      expect(stripHiddenData(bytes)).toEqual({ ok: false, reason: "type" });
    }
  });

  it("gives a chosen file back with the same name and the type its bytes really have", async () => {
    const jpeg = join(
      [0xff, 0xd8],
      [0xff, 0xfe, 0x00, 0x08],
      "SECRET",
      [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0],
      [0x12, 0x34],
      [0xff, 0xd9],
    );
    const file = new File([jpeg as BlobPart], "front.png", {
      type: "application/octet-stream",
      lastModified: 1_700_000_000_000,
    });
    const result = await stripHiddenDataFromFile(file);
    if (!result.ok) throw new Error("expected a clean picture");
    expect(result.file.name).toBe("front.png");
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.lastModified).toBe(1_700_000_000_000);
    expect(result.file.size).toBe(jpeg.length - 10);
    expect(result.removedBytes).toBe(10);
  });

  it("passes a refusal on for a chosen file", async () => {
    const result = await stripHiddenDataFromFile(
      new File(["hello"], "note.png", { type: "image/png" }),
    );
    expect(result).toEqual({ ok: false, reason: "type" });
  });
});
