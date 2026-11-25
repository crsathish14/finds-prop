import { describe, expect, it } from "vitest";
import { pictureFile } from "../../../tests/image-files";
import { prepareChosenImage, reduceChosenImage } from "../image-clean";
import { checkPictureClean } from "../image-hidden-data";
import type { ReduceDeps } from "../image-reduce";

/** A stand-in browser: a picture "weighs" 100,000 bytes times the quality it is saved at. */
const browser: ReduceDeps = {
  decode: async () => ({ width: 400, height: 300, close: () => undefined }),
  encode: async (_picture, _size, type, quality) =>
    new Blob([new Uint8Array(Math.round(quality * 100_000))], { type }),
};

describe("UT-image-clean: step 1, the hidden data", () => {
  it("passes a picture that fits, with its hidden data out", async () => {
    const file = pictureFile("image/png", 100, "front.png");
    const result = await prepareChosenImage(file, 10_000);
    expect(result.kind).toBe("fits");
    if (result.kind !== "fits") return;
    expect(result.file.name).toBe("front.png");
    expect(result.file.type).toBe("image/png");
  });

  it("says a picture is heavy when it is still over the limit after the hidden data is out", async () => {
    const file = pictureFile("image/jpeg", 5000, "front.jpg");
    const result = await prepareChosenImage(file, 1000);
    expect(result.kind).toBe("heavy");
    if (result.kind !== "heavy") return;
    expect(result.bytes).toBe(result.file.size);
    expect(result.bytes).toBeGreaterThan(1000);
  });

  it("takes a picture over the limit under it when the hidden data was the weight", async () => {
    const clean = pictureFile("image/jpeg", 600, "front.jpg");
    const bytes = new Uint8Array(await clean.arrayBuffer());
    const secret = new Uint8Array(2000);
    const comment = new Uint8Array([
      0xff,
      0xfe,
      (secret.length + 2) >> 8,
      (secret.length + 2) & 0xff,
    ]);
    const heavy = new File([bytes.slice(0, 2), comment, secret, bytes.slice(2)], "front.jpg", {
      type: "image/jpeg",
    });
    expect(heavy.size).toBeGreaterThan(1500);
    const result = await prepareChosenImage(heavy, 1000);
    expect(result.kind).toBe("fits");
  });

  it("refuses what is not a picture of a kind the site takes, whatever the file says it is", async () => {
    const svg = new File(["<svg/>"], "logo.png", { type: "image/png" });
    expect(await prepareChosenImage(svg, 1000)).toEqual({ kind: "refused", reason: "type" });
  });
});

describe("UT-image-clean: step 2, the quality", () => {
  it("gives back a file under the limit at the highest quality that fits", async () => {
    const file = pictureFile("image/jpeg", 300_000, "front.jpg");
    const result = await reduceChosenImage(
      file,
      { limitBytes: 80_000, qualityFloor: 0.75 },
      browser,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bytes).toBe(80_000);
    expect(result.file.size).toBe(80_000);
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.name).toBe("front.jpg");
    expect(result.originalBytes).toBe(file.size);
  });

  it("gives a PNG the ending of the WebP it became", async () => {
    const file = pictureFile("image/png", 300_000, "plan.final.png");
    const result = await reduceChosenImage(
      file,
      { limitBytes: 80_000, qualityFloor: 0.75 },
      browser,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.type).toBe("image/webp");
    expect(result.file.name).toBe("plan.final.webp");
  });

  it("passes on why a picture could not be made light enough", async () => {
    const file = pictureFile("image/jpeg", 300_000, "front.jpg");
    const result = await reduceChosenImage(
      file,
      { limitBytes: 50_000, qualityFloor: 0.75 },
      browser,
    );
    expect(result).toEqual({ ok: false, reason: "cannot_fit", smallestBytes: 75_000 });
  });

  it("takes the hidden data out of the lowered picture too, so the server accepts what is sent", async () => {
    // A stand-in encoder that, like some browsers, leaves a comment of its own in the JPEG it makes.
    const note = new TextEncoder().encode("ENCODER-NOTE");
    const noisy: ReduceDeps = {
      decode: browser.decode,
      encode: async (_picture, _size, type, quality) => {
        const size = Math.round(quality * 100_000);
        const body = pictureFile("image/jpeg", size).slice();
        const bytes = new Uint8Array(await body.arrayBuffer());
        const comment = new Uint8Array([0xff, 0xfe, 0x00, note.length + 2, ...note]);
        return new Blob([bytes.slice(0, 2), comment, bytes.slice(2)], { type });
      },
    };
    const file = pictureFile("image/jpeg", 300_000, "front.jpg");
    const result = await reduceChosenImage(file, { limitBytes: 80_000, qualityFloor: 0.75 }, noisy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = new Uint8Array(await result.file.arrayBuffer());
    expect(checkPictureClean(stored)).toBe("clean");
    expect(new TextDecoder().decode(stored)).not.toContain("ENCODER-NOTE");
    expect(result.bytes).toBe(result.file.size);
    expect(result.file.size).toBeLessThanOrEqual(80_000);
  });
});
