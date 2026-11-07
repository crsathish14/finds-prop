import { describe, expect, it, vi } from "vitest";
import {
  fitWithin,
  ORIGINAL_MAX_BYTES,
  PREPARE_MAX_EDGE,
  PREPARE_QUALITY,
  PrepareError,
  preparePhoto,
  type PrepareDeps,
} from "../prepare-photo";
import { PHOTO_MAX_BYTES } from "../constants";

const file = (type: string, size = 1000) => new Blob([new Uint8Array(size)], { type });
const outcome = (type: string, size = 5000) => new Blob([new Uint8Array(size)], { type });

function deps(options: {
  width?: number;
  height?: number;
  decodeFails?: boolean;
  /** What each encode attempt gives back, by asked-for type. */
  encoded?: Partial<Record<"image/webp" | "image/jpeg", Blob | null | "throw">>;
}) {
  const closed = vi.fn();
  const encode = vi.fn<PrepareDeps["encode"]>(async (_image, _size, type) => {
    const given = options.encoded && type in options.encoded;
    const result = given ? options.encoded?.[type] : outcome(type);
    if (result === "throw") throw new Error("encoder failed");
    return result ?? null;
  });
  const stand: PrepareDeps = {
    decode: async () => {
      if (options.decodeFails) throw new Error("cannot decode");
      return { width: options.width ?? 4000, height: options.height ?? 3000, close: closed };
    },
    encode,
  };
  return { stand, encode, closed };
}

describe("UT-prepare-photo: sizing", () => {
  it("scales the longest side down to 2000 and keeps the shape", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(6000, 1000)).toEqual({ width: 2000, height: 333 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(1600, 1200)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(2000, 2000)).toEqual({ width: 2000, height: 2000 });
  });

  it("never rounds a side down to nothing", () => {
    expect(fitWithin(20000, 3).height).toBeGreaterThanOrEqual(1);
  });

  it("uses a longest side of 2000 and quality 0.8", () => {
    expect(PREPARE_MAX_EDGE).toBe(2000);
    expect(PREPARE_QUALITY).toBe(0.8);
  });
});

describe("UT-prepare-photo: getting a photo ready (S6-SPK-01)", () => {
  it("makes a WebP at the fitted size and quality 0.8", async () => {
    const { stand, encode } = deps({ width: 4000, height: 3000 });
    const done = await preparePhoto(file("image/jpeg"), stand);
    expect(done).toMatchObject({ mime: "image/webp", width: 2000, height: 1500, bytes: 5000 });
    expect(done.blob.type).toBe("image/webp");
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode.mock.calls[0]?.[1]).toEqual({ width: 2000, height: 1500 });
    expect(encode.mock.calls[0]?.[3]).toBe(0.8);
  });

  it("falls back to JPEG when the browser hands back a PNG for WebP (older Safari)", async () => {
    const { stand, encode } = deps({ encoded: { "image/webp": outcome("image/png") } });
    const done = await preparePhoto(file("image/png"), stand);
    expect(done.mime).toBe("image/jpeg");
    expect(done.blob.type).toBe("image/jpeg");
    expect(encode.mock.calls.map((call) => call[2])).toEqual(["image/webp", "image/jpeg"]);
  });

  it("falls back to JPEG when the WebP encoder returns nothing or fails", async () => {
    for (const webp of [null, "throw" as const]) {
      const { stand } = deps({ encoded: { "image/webp": webp } });
      await expect(preparePhoto(file("image/jpeg"), stand)).resolves.toMatchObject({
        mime: "image/jpeg",
      });
    }
  });

  it("says it cannot be read when neither type can be made", async () => {
    const { stand } = deps({ encoded: { "image/webp": null, "image/jpeg": null } });
    await expect(preparePhoto(file("image/jpeg"), stand)).rejects.toMatchObject({
      problem: "unreadable",
    });
  });

  it("frees the picture whether it worked or not", async () => {
    const ok = deps({});
    await preparePhoto(file("image/jpeg"), ok.stand);
    expect(ok.closed).toHaveBeenCalledTimes(1);
    const bad = deps({ encoded: { "image/webp": null, "image/jpeg": null } });
    await preparePhoto(file("image/jpeg"), bad.stand).catch(() => undefined);
    expect(bad.closed).toHaveBeenCalledTimes(1);
  });

  it("refuses a file that is not a photo, without trying to read it", async () => {
    for (const type of [
      "application/pdf",
      "image/svg+xml",
      "text/html",
      "video/mp4",
      "image/gif",
    ]) {
      const { stand } = deps({});
      const decode = vi.spyOn(stand, "decode");
      await expect(preparePhoto(file(type), stand)).rejects.toMatchObject({ problem: "not_image" });
      expect(decode).not.toHaveBeenCalled();
    }
  });

  it("tries a file with no type (some phones) and HEIC (some browsers can read it)", async () => {
    for (const type of ["", "image/heic", "image/heif", "IMAGE/JPEG"]) {
      const { stand } = deps({});
      await expect(preparePhoto(file(type), stand)).resolves.toMatchObject({ mime: "image/webp" });
    }
  });

  it("says a HEIC the browser cannot read cannot be read", async () => {
    const { stand } = deps({ decodeFails: true });
    await expect(preparePhoto(file("image/heic"), stand)).rejects.toMatchObject({
      problem: "unreadable",
    });
  });

  it("refuses an original over 20 MB, and an empty file", async () => {
    const { stand } = deps({});
    const decode = vi.spyOn(stand, "decode");
    await expect(
      preparePhoto(file("image/jpeg", ORIGINAL_MAX_BYTES + 1), stand),
    ).rejects.toMatchObject({
      problem: "too_large",
    });
    await expect(preparePhoto(file("image/jpeg", 0), stand)).rejects.toMatchObject({
      problem: "unreadable",
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it("takes exactly 20 MB", async () => {
    const { stand } = deps({});
    await expect(
      preparePhoto(file("image/jpeg", ORIGINAL_MAX_BYTES), stand),
    ).resolves.toBeDefined();
  });

  it("refuses a result that is still over the server's 10 MB", async () => {
    const { stand } = deps({
      encoded: { "image/webp": outcome("image/webp", PHOTO_MAX_BYTES + 1) },
    });
    await expect(preparePhoto(file("image/jpeg"), stand)).rejects.toMatchObject({
      problem: "too_large",
    });
  });

  it("says a picture of no size cannot be read", async () => {
    const { stand } = deps({ width: 0, height: 0 });
    await expect(preparePhoto(file("image/jpeg"), stand)).rejects.toBeInstanceOf(PrepareError);
  });
});
