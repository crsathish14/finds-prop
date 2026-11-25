// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pictureFile } from "../../../tests/image-files";
import type { ReduceDeps } from "../image-reduce";
import { useImageReduce } from "../use-image-reduce";

/** A stand-in browser: a picture "weighs" 100,000 bytes times the quality it is saved at. */
function browser(options: { encode?: ReduceDeps["encode"] } = {}): ReduceDeps {
  return {
    decode: async () => ({ width: 400, height: 300, close: () => undefined }),
    encode:
      options.encode ??
      (async (_picture, _size, type, quality) =>
        new Blob([new Uint8Array(Math.round(quality * 100_000))], { type })),
  };
}

const LIMIT = 80_000;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:lowered");
  URL.revokeObjectURL = vi.fn();
});

describe("UT-use-image-reduce: a picture that fits", () => {
  it("goes straight on, shows nothing, and is the file with its hidden data out", async () => {
    const ready = vi.fn();
    const { result } = renderHook(() => useImageReduce({ limitBytes: LIMIT, deps: browser() }));
    let refused: unknown = "unset";
    await act(async () => {
      refused = await result.current.choose(pictureFile("image/jpeg", 100, "a.jpg"), ready);
    });
    expect(refused).toBeNull();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect(result.current.prompt).toBeNull();
  });

  it("gives back why a file was refused, and shows nothing", async () => {
    const ready = vi.fn();
    const { result } = renderHook(() => useImageReduce({ limitBytes: LIMIT, deps: browser() }));
    let refused: unknown = null;
    await act(async () => {
      refused = await result.current.choose(
        new File(["<svg/>"], "a.png", { type: "image/png" }),
        ready,
      );
    });
    expect(refused).toBe("type");
    expect(ready).not.toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
  });
});

describe("UT-use-image-reduce: a picture that is still too heavy", () => {
  async function heavy(deps: ReduceDeps = browser()) {
    const ready = vi.fn();
    const hook = renderHook(() => useImageReduce({ limitBytes: LIMIT, deps }));
    await act(async () => {
      await hook.result.current.choose(pictureFile("image/jpeg", 300_000, "front.jpg"), ready);
    });
    return { ...hook, ready };
  }

  it("asks first and hands nothing on", async () => {
    const { result, ready } = await heavy();
    expect(result.current.prompt).toMatchObject({
      state: "offer",
      fileName: "front.jpg",
      limitBytes: LIMIT,
    });
    expect(ready).not.toHaveBeenCalled();
  });

  it("lowers the quality when asked, shows the result, and hands the lowered file on only when it is used", async () => {
    const { result, ready } = await heavy();
    await act(async () => {
      await result.current.reduce();
    });
    expect(result.current.prompt).toMatchObject({
      state: "ready",
      reducedBytes: 80_000,
      previewUrl: "blob:lowered",
    });
    expect(ready).not.toHaveBeenCalled();
    act(() => result.current.use());
    expect(ready).toHaveBeenCalledTimes(1);
    const used = ready.mock.calls[0]?.[0] as File;
    expect(used.size).toBe(80_000);
    expect(used.type).toBe("image/jpeg");
    expect(result.current.prompt).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lowered");
  });

  it("shows the picture working while the browser lowers the quality", async () => {
    let finish: (blob: Blob | null) => void = () => undefined;
    const slow = browser({
      encode: () => new Promise<Blob | null>((resolve) => (finish = resolve)),
    });
    const { result } = await heavy(slow);
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.reduce();
    });
    await waitFor(() => expect(result.current.prompt?.state).toBe("working"));
    await act(async () => {
      finish(null);
      await running;
    });
    expect(result.current.prompt).toMatchObject({ state: "failed", reason: "no_encoder" });
  });

  it("says when even the lowest quality is too heavy, with how heavy it is", async () => {
    const { result, ready } = await heavy(
      browser({
        encode: async (_picture, _size, type) => new Blob([new Uint8Array(200_000)], { type }),
      }),
    );
    await act(async () => {
      await result.current.reduce();
    });
    expect(result.current.prompt).toMatchObject({
      state: "failed",
      reason: "cannot_fit",
      smallestBytes: 200_000,
    });
    expect(ready).not.toHaveBeenCalled();
  });

  it("says when the browser cannot make this kind of picture", async () => {
    const { result } = await heavy(browser({ encode: async () => null }));
    await act(async () => {
      await result.current.reduce();
    });
    expect(result.current.prompt).toMatchObject({ state: "failed", reason: "no_encoder" });
  });

  it("forgets everything when dismissed, and hands nothing on", async () => {
    const { result, ready } = await heavy();
    await act(async () => {
      await result.current.reduce();
    });
    act(() => result.current.dismiss());
    expect(result.current.prompt).toBeNull();
    act(() => result.current.use());
    expect(ready).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lowered");
  });

  it("starts again when another file is chosen, and the old answer no longer counts", async () => {
    const { result, ready } = await heavy();
    const second = vi.fn();
    await act(async () => {
      await result.current.choose(pictureFile("image/png", 100, "small.png"), second);
    });
    expect(result.current.prompt).toBeNull();
    expect(second).toHaveBeenCalledTimes(1);
    act(() => result.current.use());
    expect(ready).not.toHaveBeenCalled();
  });

  it("gives back the preview address when the page is left", async () => {
    const { result, unmount } = await heavy();
    await act(async () => {
      await result.current.reduce();
    });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lowered");
  });
});
