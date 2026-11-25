import { stripHiddenDataFromFile, type StripProblem } from "./image-hidden-data";
import {
  reduceToSize,
  type ReduceDeps,
  type ReduceProblem,
  type ReduceResult,
} from "./image-reduce";

/**
 * The two steps every picture goes through before it is uploaded, as plain functions (image clean-up). The hook that
 * walks the person through them is `use-image-reduce.ts`; the screens are `ImageReduceFlow` and `ImageReducePrompt`.
 *
 * Step 1, `prepareChosenImage`: the hidden data is taken out (no loss of quality). A picture that now fits its limit is
 * ready to upload; one that does not is "heavy" and the person is asked what to do. A file that is not a picture of a
 * kind the site takes is refused.
 *
 * Step 2, `reduceChosenImage`: only after the person said yes. The quality is lowered until the picture fits, down to a
 * floor and no further.
 */

export type PreparedImage =
  | { kind: "fits"; file: File }
  | { kind: "heavy"; file: File; bytes: number }
  | { kind: "refused"; reason: StripProblem };

/** Takes the hidden data out of a chosen file and says whether the result is within `limitBytes`. */
export async function prepareChosenImage(file: File, limitBytes: number): Promise<PreparedImage> {
  const stripped = await stripHiddenDataFromFile(file);
  if (!stripped.ok) return { kind: "refused", reason: stripped.reason };
  if (stripped.file.size <= limitBytes) return { kind: "fits", file: stripped.file };
  return { kind: "heavy", file: stripped.file, bytes: stripped.file.size };
}

export type ReducedImage =
  | { ok: true; file: File; bytes: number; originalBytes: number }
  | { ok: false; reason: ReduceProblem; smallestBytes: number | null };

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** The file's name with the ending of its new type (a PNG saved as WebP is no longer `.png`). */
function renamedFor(name: string, mime: string): string {
  const ending = EXTENSIONS[mime];
  if (!ending) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${ending}`;
}

/** Lowers the quality of a file that is still over its limit, to the highest quality that fits. */
export async function reduceChosenImage(
  file: File,
  options: { limitBytes: number; qualityFloor: number },
  deps: ReduceDeps,
): Promise<ReducedImage> {
  const result: ReduceResult = await reduceToSize(
    file,
    { targetBytes: options.limitBytes, qualityFloor: options.qualityFloor },
    deps,
  );
  if (!result.ok) return result;
  const lowered = new File([result.blob], renamedFor(file.name, result.mime), {
    type: result.mime,
    lastModified: file.lastModified,
  });
  // The browser's own encoder may add a little of its own (a colour profile it keeps, but also, in some browsers, a
  // note of its own): the lowered picture goes through the hidden-data step too, so what is sent is what the server
  // accepts. If it cannot be read again the picture is left as the encoder made it.
  const cleaned = await stripHiddenDataFromFile(lowered);
  const final = cleaned.ok ? cleaned.file : lowered;
  return { ok: true, bytes: final.size, originalBytes: result.originalBytes, file: final };
}
