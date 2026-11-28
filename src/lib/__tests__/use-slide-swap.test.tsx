// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SLIDE_MS, useSlideSwap } from "../use-slide-swap";

function Probe({ pageKey, order }: { pageKey: string; order: number }) {
  const { leavingKey, direction } = useSlideSwap(pageKey, order);
  return <output>{`${leavingKey ?? "none"}|${direction}`}</output>;
}

function reduceMotion(on: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: on && query.includes("reduce"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  reduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useSlideSwap: the old page stays while the new one slides in", () => {
  it("shows no leaving page at first", () => {
    render(<Probe pageKey="a1" order={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("none|from-below");
  });

  it("keeps the old page for the slide, entering a newer page from below", () => {
    const { rerender } = render(<Probe pageKey="a1" order={0} />);
    rerender(<Probe pageKey="a2" order={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("a1|from-below");
    act(() => vi.advanceTimersByTime(SLIDE_MS - 1));
    expect(screen.getByRole("status")).toHaveTextContent("a1|");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toHaveTextContent("none|");
  });

  it("enters an older page from above", () => {
    const { rerender } = render(<Probe pageKey="a2" order={1} />);
    rerender(<Probe pageKey="a1" order={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("a2|from-above");
  });

  it("does nothing when the key stays the same", () => {
    const { rerender } = render(<Probe pageKey="a1" order={0} />);
    rerender(<Probe pageKey="a1" order={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("none|");
  });

  it("swaps plainly, with no leaving page, when the visitor asked for less motion", () => {
    reduceMotion(true);
    const { rerender } = render(<Probe pageKey="a1" order={0} />);
    rerender(<Probe pageKey="a2" order={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("none|");
  });
});
