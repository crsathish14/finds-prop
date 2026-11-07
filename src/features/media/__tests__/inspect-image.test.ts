import { describe, expect, it } from "vitest";
import { inspectImage } from "../inspect-image";
import { bytes, jpeg, le32, png, webpExtended, webpLossless, webpLossy } from "./image-fixtures";

describe("UT-inspect-image: the server reads the real type and size of an upload (plan 07 section 7)", () => {
  describe("JPEG", () => {
    it("reads the size and the type", () => {
      expect(inspectImage(jpeg({ width: 1600, height: 1200 }))).toEqual({
        ok: true,
        mime: "image/jpeg",
        width: 1600,
        height: 1200,
      });
    });

    it("reads a progressive file the same way", () => {
      expect(inspectImage(jpeg({ width: 800, height: 600, progressive: true }))).toMatchObject({
        ok: true,
        width: 800,
        height: 600,
      });
    });

    it("refuses a file that still carries camera metadata (EXIF, with its GPS position)", () => {
      expect(inspectImage(jpeg({ width: 800, height: 600, exif: true }))).toEqual({
        ok: false,
        reason: "metadata",
      });
    });

    it("refuses a file that is cut short", () => {
      expect(inspectImage(jpeg({ width: 800, height: 600, cut: true }))).toEqual({
        ok: false,
        reason: "truncated",
      });
    });
  });

  describe("PNG", () => {
    it("reads the size and the type", () => {
      expect(inspectImage(png({ width: 1200, height: 900 }))).toEqual({
        ok: true,
        mime: "image/png",
        width: 1200,
        height: 900,
      });
    });

    it("refuses an EXIF chunk, an animation and a file with no end", () => {
      expect(inspectImage(png({ width: 10, height: 10, exif: true }))).toEqual({
        ok: false,
        reason: "metadata",
      });
      expect(inspectImage(png({ width: 10, height: 10, animated: true }))).toEqual({
        ok: false,
        reason: "animated",
      });
      expect(inspectImage(png({ width: 10, height: 10, ended: false }))).toEqual({
        ok: false,
        reason: "truncated",
      });
    });
  });

  describe("WebP", () => {
    it("reads a lossy file", () => {
      expect(inspectImage(webpLossy(1280, 960))).toEqual({
        ok: true,
        mime: "image/webp",
        width: 1280,
        height: 960,
      });
    });

    it("reads a lossless file", () => {
      expect(inspectImage(webpLossless(2000, 1500))).toEqual({
        ok: true,
        mime: "image/webp",
        width: 2000,
        height: 1500,
      });
    });

    it("reads the canvas of an extended file", () => {
      expect(inspectImage(webpExtended({ width: 1920, height: 1080, flags: 0 }))).toMatchObject({
        ok: true,
        width: 1920,
        height: 1080,
      });
    });

    it("refuses the EXIF flag, an EXIF chunk and an animation", () => {
      expect(inspectImage(webpExtended({ width: 10, height: 10, flags: 0x08 }))).toEqual({
        ok: false,
        reason: "metadata",
      });
      const exifChunk = bytes("EXIF", le32(4), [1, 2, 3, 4]);
      expect(
        inspectImage(webpExtended({ width: 10, height: 10, flags: 0, extraChunk: exifChunk })),
      ).toEqual({
        ok: false,
        reason: "metadata",
      });
      expect(inspectImage(webpExtended({ width: 10, height: 10, flags: 0x02 }))).toEqual({
        ok: false,
        reason: "animated",
      });
    });

    it("refuses a file cut short", () => {
      expect(inspectImage(webpLossy(100, 100).subarray(0, 20))).toEqual({
        ok: false,
        reason: "truncated",
      });
    });
  });

  describe("everything else is refused by its first bytes, whatever the file is called", () => {
    const samples: [string, Uint8Array][] = [
      ["an SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')],
      ["an SVG with an XML header", bytes('<?xml version="1.0"?><svg></svg>')],
      ["an HTML page", bytes("<!doctype html><script>alert(1)</script>")],
      ["a GIF", bytes("GIF89a", [1, 0, 1, 0, 0, 0, 0])],
      ["a PDF", bytes("%PDF-1.7 ...")],
      ["a RIFF file that is not WebP", bytes("RIFF", le32(8), "WAVE", "fmt ")],
      ["an empty file", bytes()],
    ];
    for (const [label, sample] of samples) {
      it(`refuses ${label}`, () => {
        expect(inspectImage(sample)).toEqual({ ok: false, reason: "type" });
      });
    }
  });
});
