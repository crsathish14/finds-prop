import { describe, expect, it } from "vitest";
import { SPONSOR_IMAGE_MAX_BYTES } from "../constants";
import { SPONSOR_SLOTS, readImageInfo, slotFit, slotProblem } from "../sponsor-rules";
import { jpeg, notAPicture, png, webpExtended, webpLossless, webpLossy } from "./sponsor-fixtures";

const slotOf = (format: "strip" | "panel", device: "desktop" | "compact") => {
  const found = SPONSOR_SLOTS.find((slot) => slot.format === format && slot.device === device);
  if (!found) throw new Error(`no ${format} ${device} slot`);
  return found;
};
const stripDesktop = slotOf("strip", "desktop");
const stripPhone = slotOf("strip", "compact");
const panelDesktop = slotOf("panel", "desktop");
const panelPhone = slotOf("panel", "compact");

describe("UT-sponsor-image: the type and size are read from the file's own bytes (S7-T11)", () => {
  it.each([
    ["a PNG", png(1940, 180), "image/png"],
    ["a JPEG", jpeg(1940, 180), "image/jpeg"],
    ["a lossy WebP", webpLossy(1940, 180), "image/webp"],
    ["a lossless WebP", webpLossless(1940, 180), "image/webp"],
    ["an extended WebP", webpExtended(1940, 180), "image/webp"],
  ] as const)("reads %s", (_name, bytes, type) => {
    expect(readImageInfo(bytes)).toEqual({ type, width: 1940, height: 180 });
  });

  it("reads other sizes too, not one remembered answer", () => {
    expect(readImageInfo(png(1048, 988))).toMatchObject({ width: 1048, height: 988 });
    expect(readImageInfo(jpeg(640, 200))).toMatchObject({ width: 640, height: 200 });
    expect(readImageInfo(webpLossless(1280, 640))).toMatchObject({ width: 1280, height: 640 });
  });

  it("refuses an SVG, a script and an empty or cut-off file: none has a picture signature", () => {
    expect(readImageInfo(notAPicture())).toBeNull();
    expect(readImageInfo(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(readImageInfo(new Uint8Array())).toBeNull();
    expect(readImageInfo(png(10, 10).subarray(0, 12))).toBeNull();
    expect(readImageInfo(jpeg(10, 10).subarray(0, 3))).toBeNull();
  });

  it("refuses a picture that says it is nothing wide or nothing tall", () => {
    expect(readImageInfo(png(0, 180))).toBeNull();
    expect(readImageInfo(jpeg(1940, 0))).toBeNull();
  });
});

describe("UT-sponsor-slot: which picture fits which slot (S7-T11, DEC-15)", () => {
  const info = (width: number, height: number) => ({ type: "image/webp" as const, width, height });

  it("accepts a picture of twice the slot's size and shape in each of the four slots", () => {
    expect(slotProblem(stripDesktop, info(1940, 180), 96_000)).toBeNull();
    expect(slotProblem(stripPhone, info(640, 200), 41_000)).toBeNull();
    expect(slotProblem(panelDesktop, info(1048, 988), 118_000)).toBeNull();
    expect(slotProblem(panelPhone, info(1280, 640), 83_000)).toBeNull();
  });

  it("refuses what is not a picture, then what is too heavy, then too small, then the wrong shape", () => {
    expect(slotProblem(stripDesktop, null, 100)).toBe("type");
    expect(slotProblem(stripDesktop, info(1940, 180), SPONSOR_IMAGE_MAX_BYTES + 1)).toBe("size");
    expect(slotProblem(stripDesktop, info(970, 90), 10_000)).toBe("small");
    expect(slotProblem(stripDesktop, info(1940, 1760), 10_000)).toBe("shape");
  });

  it("allows exactly the weight limit and no more", () => {
    expect(slotProblem(stripPhone, info(640, 200), SPONSOR_IMAGE_MAX_BYTES)).toBeNull();
    expect(slotProblem(stripPhone, info(640, 200), SPONSOR_IMAGE_MAX_BYTES + 1)).toBe("size");
  });

  it("calls a picture too small when either side is under twice the slot, and a huge one too", () => {
    expect(slotProblem(panelPhone, info(1280, 639), 10_000)).toBe("small");
    expect(slotProblem(panelPhone, info(1279, 640), 10_000)).toBe("small");
    expect(slotProblem(stripPhone, info(6001, 1876), 10_000)).toBe("small");
  });

  it("takes a near miss (it is shown whole on a plain background) and refuses a far one", () => {
    // The strip's shape is 970 : 90. 1940 x 220 is about 20 % off: shown whole, not refused.
    expect(slotFit(stripDesktop, info(1940, 220))).toBe("contain");
    expect(slotProblem(stripDesktop, info(1940, 220), 10_000)).toBeNull();
    expect(slotFit(stripDesktop, info(1940, 180))).toBe("cover");
    expect(slotFit(stripDesktop, info(1940, 400))).toBe("rejected");
    expect(slotProblem(stripDesktop, info(1940, 400), 10_000)).toBe("shape");
  });
});
