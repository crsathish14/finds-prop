// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterKeyboardCloses, isTouchScreen } from "../keyboard";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isTouchScreen", () => {
  it("is true when the main pointer is a finger", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)" }));
    expect(isTouchScreen()).toBe(true);
  });

  it("is false for a mouse, and when the browser cannot say", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(isTouchScreen()).toBe(false);
    vi.stubGlobal("matchMedia", undefined);
    expect(isTouchScreen()).toBe(false);
  });
});

describe("afterKeyboardCloses", () => {
  let viewport: EventTarget;
  beforeEach(() => {
    vi.useFakeTimers();
    viewport = new EventTarget();
  });

  it("runs once, after the screen has changed size and stayed still", () => {
    const settled = vi.fn();
    afterKeyboardCloses(settled, viewport);
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(60);
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(99);
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(settled).toHaveBeenCalledTimes(1);
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(500);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the size never changes, and can be cancelled", () => {
    const settled = vi.fn();
    afterKeyboardCloses(settled, viewport);
    vi.advanceTimersByTime(1500);
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(500);
    expect(settled).not.toHaveBeenCalled();

    const cancelled = vi.fn();
    const cancel = afterKeyboardCloses(cancelled, viewport);
    cancel();
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(500);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("is harmless in a browser without a visual viewport", () => {
    const settled = vi.fn();
    expect(() => afterKeyboardCloses(settled, null)()).not.toThrow();
    expect(settled).not.toHaveBeenCalled();
  });
});
