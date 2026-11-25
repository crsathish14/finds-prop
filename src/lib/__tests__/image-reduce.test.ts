import { describe, expect, it, vi } from "vitest";
import {
  QUALITY_CEILING,
  QUALITY_FLOOR,
  QUALITY_FLOOR_DETAILED,
  REDUCE_INPUT_MAX_BYTES,
  reduceToSize,
  type ReduceDeps,
} from "../image-reduce";

const jpeg = (size: number) =>
  new Blob([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), new Uint8Array(size)], { type: "image/jpeg" });
const png = (size: number) =>
  new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), new Uint8Array(size)], {
    type: "image/png",
  });
const webp = (size: number) =>
  new Blob(
    [
      Uint8Array.from("RIFF\0\0\0\0WEBPVP8L", (letter) => letter.charCodeAt(0)),
      new Uint8Array(size),
    ],
    {
      type: "image/webp",
    },
  );

/** A stand-in browser: a file of quality 0.8 weighs 80,000 bytes, so the weight follows the quality in a straight line. */
function browser(options: {
  width?: number;
  height?: number;
  decodeFails?: boolean;
  /** What an encode gives back; the default is a blob of the asked-for type that weighs 100,000 times the quality. */
  encode?: ReduceDeps["encode"];
}) {
  const closed = vi.fn();
  const encode = vi.fn<ReduceDeps["encode"]>(
    options.encode ??
      (async (_picture, _size, type, quality) =>
        new Blob([new Uint8Array(Math.round(quality * 100_000))], { type })),
  );
  const deps: ReduceDeps = {
    decode: async () => {
      if (options.decodeFails) throw new Error("cannot decode");
      return { width: options.width ?? 4000, height: options.height ?? 3000, close: closed };
    },
    encode,
  };
  return { deps, encode, closed };
}

const lowest = { qualityFloor: QUALITY_FLOOR };

describe("UT-image-reduce: finding the quality", () => {
  it("leaves a file that already fits exactly as it is", async () => {
    const { deps, encode } = browser({});
    const file = jpeg(50_000);
    const result = await reduceToSize(file, { targetBytes: 80_000, ...lowest }, deps);
    expect(result).toMatchObject({ ok: true, quality: null, mime: "image/jpeg", bytes: file.size });
    if (result.ok) expect(result.blob).toBe(file);
    expect(encode).not.toHaveBeenCalled();
  });

  it("takes the highest quality that fits, not the lowest", async () => {
    const { deps } = browser({});
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps);
    if (!result.ok) throw new Error("expected a reduced picture");
    expect(result.quality).toBe(0.8);
    expect(result.bytes).toBe(80_000);
    expect(result.bytes).toBeLessThanOrEqual(80_000);
    expect(result.originalBytes).toBe(300_004);
  });

  it("uses the top quality when that already fits", async () => {
    const { deps, encode } = browser({});
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 120_000, ...lowest }, deps);
    expect(result).toMatchObject({ ok: true, quality: QUALITY_CEILING });
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("stops at the floor when only the floor fits", async () => {
    const { deps } = browser({});
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 75_000, ...lowest }, deps);
    expect(result).toMatchObject({ ok: true, quality: QUALITY_FLOOR, bytes: 75_000 });
  });

  it("never goes below the floor: it says how heavy the picture is there and asks for another", async () => {
    const { deps, encode } = browser({});
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 70_000, ...lowest }, deps);
    expect(result).toEqual({ ok: false, reason: "cannot_fit", smallestBytes: 75_000 });
    const qualities = encode.mock.calls.map((call) => call[3]);
    expect(Math.min(...qualities)).toBe(QUALITY_FLOOR);
  });

  it("uses the higher floor for pictures with fine detail", async () => {
    const { deps } = browser({});
    const options = { targetBytes: 80_000, qualityFloor: QUALITY_FLOOR_DETAILED };
    expect(await reduceToSize(jpeg(300_000), options, deps)).toEqual({
      ok: false,
      reason: "cannot_fit",
      smallestBytes: 85_000,
    });
  });

  it("does not try more than a handful of times", async () => {
    const { deps, encode } = browser({});
    await reduceToSize(jpeg(300_000), { targetBytes: 83_456, ...lowest }, deps);
    expect(encode.mock.calls.length).toBeLessThanOrEqual(8);
  });
});

describe("UT-image-reduce: what comes out", () => {
  it("keeps the pixel size", async () => {
    const { deps, encode } = browser({ width: 3000, height: 2000 });
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps);
    expect(result).toMatchObject({ ok: true, width: 3000, height: 2000 });
    for (const call of encode.mock.calls) expect(call[1]).toEqual({ width: 3000, height: 2000 });
  });

  it("keeps a JPEG a JPEG", async () => {
    const { deps, encode } = browser({});
    const result = await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps);
    expect(result).toMatchObject({ ok: true, mime: "image/jpeg" });
    for (const call of encode.mock.calls) expect(call[2]).toBe("image/jpeg");
  });

  it("saves a PNG and a WebP as WebP", async () => {
    for (const file of [png(300_000), webp(300_000)]) {
      const { deps, encode } = browser({});
      const result = await reduceToSize(file, { targetBytes: 80_000, ...lowest }, deps);
      expect(result).toMatchObject({ ok: true, mime: "image/webp" });
      for (const call of encode.mock.calls) expect(call[2]).toBe("image/webp");
    }
  });

  it("frees the picture after every outcome", async () => {
    for (const target of [120_000, 80_000, 70_000]) {
      const { deps, closed } = browser({});
      await reduceToSize(jpeg(300_000), { targetBytes: target, ...lowest }, deps);
      expect(closed).toHaveBeenCalledTimes(1);
    }
  });
});

describe("UT-image-reduce: what cannot be reduced", () => {
  it("says so when the browser cannot make the type (a PNG asked for as WebP comes back as PNG)", async () => {
    const { deps } = browser({
      encode: async (_picture, _size, _type, quality) =>
        new Blob([new Uint8Array(Math.round(quality * 100_000))], { type: "image/png" }),
    });
    expect(await reduceToSize(png(300_000), { targetBytes: 80_000, ...lowest }, deps)).toEqual({
      ok: false,
      reason: "no_encoder",
      smallestBytes: null,
    });
  });

  it("says so when the browser gives nothing or fails to encode", async () => {
    for (const encode of [
      async () => null,
      async () => {
        throw new Error("encoder failed");
      },
      async () => new Blob([], { type: "image/jpeg" }),
    ] satisfies ReduceDeps["encode"][]) {
      const { deps } = browser({ encode });
      expect(
        await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps),
      ).toMatchObject({
        ok: false,
        reason: "no_encoder",
      });
    }
  });

  it("refuses a file that is not a JPEG, PNG or WebP, whatever type it declares", async () => {
    const { deps, encode } = browser({});
    const fake = new Blob(["<svg></svg>", new Uint8Array(300_000)], { type: "image/png" });
    expect(await reduceToSize(fake, { targetBytes: 80_000, ...lowest }, deps)).toMatchObject({
      ok: false,
      reason: "not_image",
    });
    expect(encode).not.toHaveBeenCalled();
  });

  it("refuses a file that is too big to open in the browser", async () => {
    const { deps } = browser({});
    const result = await reduceToSize(
      jpeg(REDUCE_INPUT_MAX_BYTES + 1),
      { targetBytes: 80_000, ...lowest },
      deps,
    );
    expect(result).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("says so when the browser cannot read the file", async () => {
    const { deps, closed } = browser({ decodeFails: true });
    expect(
      await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps),
    ).toMatchObject({
      ok: false,
      reason: "unreadable",
    });
    expect(closed).not.toHaveBeenCalled();
  });

  it("says so when the picture has no size", async () => {
    const { deps, closed } = browser({ width: 0, height: 0 });
    expect(
      await reduceToSize(jpeg(300_000), { targetBytes: 80_000, ...lowest }, deps),
    ).toMatchObject({
      ok: false,
      reason: "unreadable",
    });
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
