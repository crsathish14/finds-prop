import { expect, test, type Page } from "@playwright/test";
import { inspectImage } from "../../src/features/media/inspect-image";
import { settle } from "./helpers";

// S6-SPK-01: the browser step that makes a photo ready (smaller, upright, no camera data), run in a real
// browser against the live specimen of the Design Lab's "Photo uploader" entry. The specimen runs the
// server's own image checks on the result. It does not upload anything.

/** A JPEG made in the page (no picture library needed), optionally with a camera data block spliced in. */
async function makeJpeg(
  page: Page,
  options: { width: number; height: number; orientation?: number; gps?: boolean },
): Promise<Buffer> {
  const bytes = await page.evaluate(async (settings) => {
    const canvas = document.createElement("canvas");
    canvas.width = settings.width;
    canvas.height = settings.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.fillStyle = "#2f7d5b";
    context.fillRect(0, 0, settings.width, settings.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, settings.width / 10, settings.height / 10);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) throw new Error("no jpeg");
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    if (settings.orientation === undefined && !settings.gps) return Array.from(jpeg);

    // "Exif\0\0", a big-endian TIFF header, and one entry: the camera rotation (tag 0x0112).
    const exif = [
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00,
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
      settings.orientation ?? 1,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ];
    const segment = [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff, ...exif];
    return Array.from(new Uint8Array([...jpeg.slice(0, 2), ...segment, ...jpeg.slice(2)]));
  }, options);
  return Buffer.from(bytes);
}

const fileInput = (page: Page) =>
  page.locator('[data-slot="photo-uploader"]').last().locator('input[type="file"]');
const result = (page: Page) => page.getByTestId("photo-demo-result");
/** The live specimen is the last uploader on the board; the earlier ones are fixed pictures of each state. */
const live = (page: Page) => page.locator('[data-slot="photo-uploader"]').last();

test.describe("Photo uploader: the browser step (S6-SPK-01)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-system/domain");
    await settle(page);
  });

  test("a large photo with camera data comes out at 2000 px, with no camera data", async ({
    page,
  }) => {
    const original = await makeJpeg(page, { width: 4000, height: 3000, orientation: 1 });
    // The test photo really does carry camera data: the server's own reader refuses it.
    expect(inspectImage(new Uint8Array(original))).toEqual({ ok: false, reason: "metadata" });

    await fileInput(page).setInputFiles({
      name: "kitchen.jpg",
      mimeType: "image/jpeg",
      buffer: original,
    });
    await expect(result(page)).toHaveText("accepted: image/webp 2000x1500, no camera data", {
      timeout: 20_000,
    });
  });

  test("a phone photo stored sideways comes out upright (the camera rotation is applied)", async ({
    page,
  }) => {
    // Stored 4000 wide and 3000 tall, marked "rotate a quarter turn": it should be 3000 wide, 4000 tall.
    const sideways = await makeJpeg(page, { width: 4000, height: 3000, orientation: 6 });
    await fileInput(page).setInputFiles({
      name: "hall.jpg",
      mimeType: "image/jpeg",
      buffer: sideways,
    });
    await expect(result(page)).toHaveText("accepted: image/webp 1500x2000, no camera data", {
      timeout: 20_000,
    });
  });

  test("a small photo is not made bigger", async ({ page }) => {
    const small = await makeJpeg(page, { width: 800, height: 600 });
    await fileInput(page).setInputFiles({
      name: "small.jpg",
      mimeType: "image/jpeg",
      buffer: small,
    });
    await expect(result(page)).toHaveText("accepted: image/webp 800x600, no camera data", {
      timeout: 20_000,
    });
  });

  test("a file that is not a photo is turned away with the reason", async ({ page }) => {
    // Chosen again until the page has finished loading: a file chosen before that is not seen.
    await expect(async () => {
      await fileInput(page).setInputFiles({
        name: "brochure.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7 not a photo"),
      });
      await expect(live(page).getByText("This file is not a photo.")).toBeVisible({
        timeout: 2000,
      });
    }).toPass({ timeout: 15_000 });
    await expect(result(page)).toHaveText("");
  });

  test("a damaged photo says it cannot be read", async ({ page }) => {
    await expect(async () => {
      await fileInput(page).setInputFiles({
        name: "broken.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
      });
      await expect(
        live(page).getByText("This photo cannot be read here. Use a JPEG, PNG or WebP photo."),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
  });
});
