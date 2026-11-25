import { useEffect, useRef, useState } from "react";
import { browserImageDeps } from "./image-browser";
import { prepareChosenImage, reduceChosenImage } from "./image-clean";
import type { StripProblem } from "./image-hidden-data";
import { QUALITY_FLOOR, type ReduceDeps } from "./image-reduce";

/**
 * Walks the person through a picture that is over its limit (image clean-up). The upload box calls `choose` with the
 * file the person picked:
 *  - the hidden data is taken out first, with no loss of quality; if the picture then fits, `onReady` gets it at once
 *    and nothing is shown;
 *  - if it still does not fit, `prompt` is the question "lower the quality to fit?" (state "offer");
 *  - `reduce` lowers the quality ("working"), then shows the result ("ready") for the person to judge, or says it could not
 *    be done ("failed");
 *  - `use` hands the lowered picture to `onReady`; `dismiss` forgets everything (also when the person chooses another file).
 * The file is never sent anywhere here: `onReady` is the box's own upload.
 */

export type ImagePrompt =
  | { state: "offer"; fileName: string; bytes: number; limitBytes: number }
  | { state: "working"; fileName: string; bytes: number; limitBytes: number }
  | {
      state: "ready";
      fileName: string;
      bytes: number;
      limitBytes: number;
      reducedBytes: number;
      /** An address the browser can show the lowered picture from. Given back when the prompt goes. */
      previewUrl: string;
    }
  | {
      state: "failed";
      /** `cannot_fit`: too heavy even at the floor. `no_encoder`: this browser cannot make this kind of picture. */
      reason: "cannot_fit" | "no_encoder" | "other";
      fileName: string;
      bytes: number;
      limitBytes: number;
      smallestBytes: number | null;
    };

export type UseImageReduceOptions = {
  /** The most the file may weigh, in bytes. */
  limitBytes: number;
  /** The lowest quality to go to (`QUALITY_FLOOR` unless the pictures have fine detail). */
  qualityFloor?: number;
  /** The browser's decoding and encoding; a test gives its own. */
  deps?: ReduceDeps;
};

export function useImageReduce({
  limitBytes,
  qualityFloor = QUALITY_FLOOR,
  deps = browserImageDeps,
}: UseImageReduceOptions) {
  const [prompt, setPrompt] = useState<ImagePrompt | null>(null);
  /** The file with its hidden data out, waiting for the person's answer. */
  const cleaned = useRef<File | null>(null);
  /** The file after its quality was lowered, waiting to be used. */
  const lowered = useRef<File | null>(null);
  const whenReady = useRef<((file: File) => void) | null>(null);
  const address = useRef<string | null>(null);
  /** Counts the walks, so an answer that arrives after the person moved on is ignored. */
  const walk = useRef(0);

  const forget = () => {
    walk.current += 1;
    cleaned.current = null;
    lowered.current = null;
    whenReady.current = null;
    if (address.current) URL.revokeObjectURL(address.current);
    address.current = null;
  };

  useEffect(() => {
    const held = address;
    return () => {
      if (held.current) URL.revokeObjectURL(held.current);
    };
  }, []);

  /**
   * Takes a chosen file. Gives back why it was refused (not a picture of a kind the site takes), or `null`. A picture
   * within the limit goes straight to `onReady`; a heavier one waits for the person's answer.
   */
  const choose = async (
    file: File,
    onReady: (file: File) => void,
  ): Promise<StripProblem | null> => {
    forget();
    setPrompt(null);
    const mine = walk.current;
    const prepared = await prepareChosenImage(file, limitBytes);
    if (mine !== walk.current) return null;
    if (prepared.kind === "refused") return prepared.reason;
    if (prepared.kind === "fits") {
      onReady(prepared.file);
      return null;
    }
    cleaned.current = prepared.file;
    whenReady.current = onReady;
    setPrompt({ state: "offer", fileName: file.name, bytes: prepared.bytes, limitBytes });
    return null;
  };

  const reduce = async () => {
    const source = cleaned.current;
    if (!source) return;
    const mine = walk.current;
    const base = { fileName: source.name, bytes: source.size, limitBytes };
    setPrompt({ state: "working", ...base });
    const result = await reduceChosenImage(source, { limitBytes, qualityFloor }, deps);
    if (mine !== walk.current) return;
    if (!result.ok) {
      const reason =
        result.reason === "cannot_fit" || result.reason === "no_encoder" ? result.reason : "other";
      setPrompt({ state: "failed", reason, smallestBytes: result.smallestBytes, ...base });
      return;
    }
    lowered.current = result.file;
    address.current = URL.createObjectURL(result.file);
    setPrompt({ state: "ready", ...base, reducedBytes: result.bytes, previewUrl: address.current });
  };

  const use = () => {
    const file = lowered.current;
    const done = whenReady.current;
    forget();
    setPrompt(null);
    if (file && done) done(file);
  };

  const dismiss = () => {
    forget();
    setPrompt(null);
  };

  return { prompt, choose, reduce, use, dismiss };
}
