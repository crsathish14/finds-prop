import type { DecodedImage, PrepareDeps } from "./prepare-photo";

/**
 * The browser's own decoding and encoding for `preparePhoto` (S6-SPK-01). Only called in a browser, from a
 * button press, so nothing here runs on the server. Decoding asks for the camera rotation to be applied;
 * drawing onto a new canvas is what leaves the metadata behind.
 */
type BrowserDecoded = DecodedImage & { bitmap: ImageBitmap };

function newCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export const browserImage: PrepareDeps = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const decoded: BrowserDecoded = {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
    return decoded;
  },
  async encode(image, size, type, quality) {
    const { bitmap } = image as BrowserDecoded;
    const canvas = newCanvas(size.width, size.height);
    const context = canvas.getContext("2d") as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return null;
    if (type === "image/jpeg") {
      // No transparency in a JPEG: put the picture on white rather than on black.
      context.fillStyle = "white";
      context.fillRect(0, 0, size.width, size.height);
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvasToBlob(canvas, type, quality);
  },
};
